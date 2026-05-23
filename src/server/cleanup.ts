import crypto from "crypto";
import type { Db, Filter, ObjectId } from "mongodb";

const IMAGE_TTL_MS = 48 * 60 * 60 * 1000;

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

function getPublicIdFromUrl(url: string): string | null {
  const marker = "/upload/";
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return null;

  const afterUpload = url.slice(markerIndex + marker.length);
  const withoutVersion = afterUpload.replace(/^v\d+\//, "");
  const withoutExtension = withoutVersion.replace(/\.[^/.]+$/, "");
  return withoutExtension || null;
}

async function deleteCloudinaryImage(publicId: string) {
  const config = getCloudinaryConfig();
  if (!config || !publicId) return;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signatureBase = `public_id=${publicId}&timestamp=${timestamp}${config.apiSecret}`;
  const signature = crypto.createHash("sha1").update(signatureBase).digest("hex");

  const form = new FormData();
  form.append("public_id", publicId);
  form.append("timestamp", timestamp);
  form.append("api_key", config.apiKey);
  form.append("signature", signature);

  await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
    method: "POST",
    body: form,
  }).catch(() => {});
}

export async function deleteCloudinaryImages(publicIds: string[]) {
  const uniqueIds = Array.from(new Set(publicIds.filter(Boolean)));
  await Promise.all(uniqueIds.map((id) => deleteCloudinaryImage(id)));
}

function getDeadlineDate(deadline: unknown): Date | null {
  if (!deadline || typeof deadline !== "string") return null;
  const date = new Date(deadline);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getImageDueAt(baseDate: Date, deadline: Date | null) {
  const ttlDueAt = new Date(baseDate.getTime() + IMAGE_TTL_MS);
  if (deadline && deadline.getTime() < ttlDueAt.getTime()) return deadline;
  return ttlDueAt;
}

function getQuestionImagePublicIds(questions: any[]) {
  return questions
    .map((question) => question.imagePublicId || getPublicIdFromUrl(question.imageUrl || ""))
    .filter(Boolean);
}

function getSubmissionImagePublicIds(submission: any) {
  const rootIds = (submission.imagePublicIds || []).filter(Boolean);
  const answerIds = (submission.answers || []).flatMap((answer: any) => {
    const storedIds = (answer.imagePublicIds || []).filter(Boolean);
    const idsFromUrls = (answer.imageUrls || []).map(getPublicIdFromUrl).filter(Boolean);
    return [...storedIds, ...idsFromUrls];
  });

  const rootUrlIds = (submission.imageUrls || []).map(getPublicIdFromUrl).filter(Boolean);
  return [...rootIds, ...answerIds, ...rootUrlIds];
}

function compactAnswersAfterImageCleanup(answers: any[] = []) {
  return answers.map((answer) => ({
    questionId: answer.questionId,
    questionTitle: answer.questionTitle,
    text: answer.text,
  }));
}

export async function deleteSubmissionsWithImages(db: Db, filter: Filter<any>) {
  const submissions = await db.collection("submissions").find(filter).toArray();

  for (const submission of submissions) {
    await deleteCloudinaryImages(getSubmissionImagePublicIds(submission));
  }

  if (submissions.length === 0) return 0;

  const result = await db.collection("submissions").deleteMany({
    _id: { $in: submissions.map((submission) => submission._id) },
  });

  return result.deletedCount || 0;
}

export async function deleteTestFilesAndSubmissions(
  db: Db,
  testId: ObjectId,
  adminId?: string,
) {
  const test = await db.collection("tests").findOne({
    _id: testId,
    ...(adminId ? { adminId } : {}),
  });

  if (!test) return false;

  await deleteCloudinaryImages(getQuestionImagePublicIds(test.questions || []));
  await deleteSubmissionsWithImages(db, { testId });

  return true;
}

async function clearSubmissionImages(db: Db, submission: any, now: Date) {
  await deleteCloudinaryImages(getSubmissionImagePublicIds(submission));
  await db.collection("submissions").updateOne(
    { _id: submission._id, imagesClearedAt: { $exists: false } },
    {
      $set: {
        imageUrls: [],
        imagePublicIds: [],
        answers: compactAnswersAfterImageCleanup(submission.answers || []),
        imagesClearedAt: now,
      },
    },
  );
}

export async function cleanupExpiredTestsAndImages(db: Db) {
  const now = new Date();
  const imageCutoff = new Date(now.getTime() - IMAGE_TTL_MS);

  const tests = await db
    .collection("tests")
    .find({
      status: { $in: ["published", "draft"] },
      $or: [
        { deadline: { $lte: now.toISOString() } },
        { questionsClearedAt: { $exists: false }, createdAt: { $lte: imageCutoff } },
      ],
    })
    .toArray();

  for (const test of tests) {
    const deadline = getDeadlineDate(test.deadline);
    const createdAt = test.createdAt instanceof Date ? test.createdAt : new Date(test.createdAt || Date.now());
    const questionImagesDueAt = getImageDueAt(createdAt, deadline);
    const isExpired = Boolean(deadline && deadline <= now);
    const shouldClearQuestionImages = questionImagesDueAt <= now;
    const questionPublicIds = getQuestionImagePublicIds(test.questions || []);

    if (shouldClearQuestionImages && !test.questionsClearedAt && questionPublicIds.length > 0) {
      await deleteCloudinaryImages(questionPublicIds);
    }

    if (isExpired) {
      await db.collection("tests").updateOne(
        { _id: test._id },
        {
          $set: {
            status: "expired",
            questions: [],
            questionsClearedAt: now,
            updatedAt: now,
          },
        },
      );
    } else if (shouldClearQuestionImages && !test.questionsClearedAt) {
      await db.collection("tests").updateOne(
        { _id: test._id },
        {
          $set: {
            questions: (test.questions || []).map((question: any) => ({
              id: question.id,
              text: question.text,
              marks: question.marks,
            })),
            updatedAt: now,
          },
        },
      );
    }

    const submissions = await db
      .collection("submissions")
      .find({
        testId: test._id,
        imagesClearedAt: { $exists: false },
        ...(isExpired ? {} : { submittedAt: { $lte: imageCutoff } }),
      })
      .toArray();

    for (const submission of submissions) {
      const submittedAt =
        submission.submittedAt instanceof Date
          ? submission.submittedAt
          : new Date(submission.submittedAt || Date.now());
      const submissionImagesDueAt = getImageDueAt(submittedAt, deadline);

      if (submissionImagesDueAt > now) continue;

      await clearSubmissionImages(db, submission, now);
    }
  }

  const staleSubmissions = await db
    .collection("submissions")
    .aggregate([
      {
        $match: {
          imagesClearedAt: { $exists: false },
          submittedAt: { $lte: imageCutoff },
        },
      },
      {
        $lookup: {
          from: "tests",
          localField: "testId",
          foreignField: "_id",
          as: "test",
        },
      },
    ])
    .toArray();

  for (const submission of staleSubmissions) {
    const test = submission.test?.[0];
    const deadline = getDeadlineDate(test?.deadline);
    const submittedAt =
      submission.submittedAt instanceof Date
        ? submission.submittedAt
        : new Date(submission.submittedAt || Date.now());

    if (getImageDueAt(submittedAt, deadline) <= now) {
      await clearSubmissionImages(db, submission, now);
    }
  }
}
