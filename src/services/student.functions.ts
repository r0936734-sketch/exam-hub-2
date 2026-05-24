import { createServerFn } from "@tanstack/react-start";
import { connectToDatabase } from "@/server/db";
import { getStudentProfileByUserId } from "@/server/user";
import { cleanupExpiredTestsAndImages } from "@/server/cleanup";
import { getAllActiveAdmins } from "@/server/admin";
import { ObjectId } from "mongodb";
import { requireSession } from "@/server/session";

export const getStudentNoticesServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    try {
      const db = await connectToDatabase();
      await requireSession(db, "student", data.token);
      const notices = await db
        .collection("notices")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      return {
        notices: notices.map((notice) => ({
          id: notice._id.toString(),
          text: notice.text || "",
          adminId: notice.adminId || "",
          adminName: notice.adminName || notice.adminId || "Admin",
          createdAt: notice.createdAt?.toISOString?.() || new Date().toISOString(),
        })),
      };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to fetch notices");
    }
  });

/**
 * Get all published tests for students
 */
export const getPublishedTestsServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    try {
      const db = await connectToDatabase();
      const { payload: student } = await requireSession(db, "student", data.token);
      await cleanupExpiredTestsAndImages(db);

      const tests = await db
        .collection("tests")
        .find({ status: "published" })
        .project({
          _id: 1,
          adminId: 1,
          adminName: 1,
          title: 1,
          subject: 1,
          deadline: 1,
          totalQuestions: 1,
          createdAt: 1,
        })
        .sort({ createdAt: -1 })
        .toArray();

      const admins = await db
        .collection("admins")
        .find({ userId: { $in: tests.map((test) => test.adminId).filter(Boolean) } })
        .project({ userId: 1, name: 1 })
        .toArray();
      const adminsById = new Map(admins.map((admin) => [admin.userId, admin.name]));

      const testIds = tests.map((test) => test._id);
      const submissions = await db
        .collection("submissions")
        .find({ studentId: student.userId, testId: { $in: testIds } })
        .project({ testId: 1, status: 1 })
        .toArray();
      const submittedTestIds = new Set(submissions.map((submission) => submission.testId.toString()));

      return {
        tests: tests.map((t) => ({
          id: t._id?.toString(),
          title: t.title,
          subject: t.subject,
          deadline: t.deadline,
          totalQuestions: t.totalQuestions,
          uploadedByAdminId: t.adminId || "",
          uploadedByAdminName: t.adminName || adminsById.get(t.adminId) || t.adminId || "Admin",
          studentStatus: submittedTestIds.has(t._id.toString()) ? "attempted" : "pending",
          createdAt: t.createdAt ? t.createdAt.toISOString() : new Date().toISOString(),
        })),
      };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to fetch tests");
    }
  });

export const getStudentDashboardServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    try {
      const db = await connectToDatabase();
      const { payload: student } = await requireSession(db, "student", data.token);
      await cleanupExpiredTestsAndImages(db);

      const profile = await getStudentProfileByUserId(db, student.userId);
      if (!profile) {
        throw new Error("Student not found");
      }

      const user = await db.collection("users").findOne({
        role: "student",
        userId: student.userId,
      });

      const recentSubmissions = await db
        .collection("submissions")
        .aggregate([
          { $match: { studentId: student.userId, status: "evaluated" } },
          {
            $lookup: {
              from: "tests",
              localField: "testId",
              foreignField: "_id",
              as: "test",
            },
          },
          { $sort: { evaluatedAt: -1, submittedAt: -1 } },
          { $limit: 5 },
        ])
        .toArray();

      const topScore = recentSubmissions.reduce(
        (best, submission) => Math.max(best, Number(submission.marks || 0)),
        0,
      );

      return {
        stats: {
          averageMarks: profile.avgMarks,
          totalTests: Number(user?.totalTests || 0),
          currentRank: profile.rank || 0,
          totalStudents: profile.totalStudents,
          topScore,
        },
        recentScores: recentSubmissions.map((submission) => {
          const test = submission.test?.[0];
          return {
            id: submission._id.toString(),
            title: test?.title || "Untitled test",
            score: Number(submission.marks || 0),
            total: 100,
            date:
              submission.evaluatedAt?.toISOString?.() ||
              submission.submittedAt?.toISOString?.() ||
              new Date().toISOString(),
          };
        }),
      };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to fetch dashboard");
    }
  });

/**
 * Get test details with all questions
 */
export const getTestDetailServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; testId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const db = await connectToDatabase();
      const { payload: student } = await requireSession(db, "student", data.token);
      await cleanupExpiredTestsAndImages(db);
      const test = await db.collection("tests").findOne({
        _id: new ObjectId(data.testId),
        status: "published",
      });

      if (!test) {
        throw new Error("Test not found");
      }

      const admin = test.adminId
        ? await db.collection("admins").findOne({ userId: test.adminId })
        : null;
      const existingSubmission = await db.collection("submissions").findOne({
        studentId: student.userId,
        testId: new ObjectId(data.testId),
      });

      return {
        test: {
          id: test._id?.toString(),
          uploadedByAdminId: test.adminId || "",
          uploadedByAdminName: test.adminName || admin?.name || test.adminId || "Admin",
          title: test.title,
          subject: test.subject,
          deadline: test.deadline,
          totalQuestions: test.totalQuestions,
          alreadySubmitted: Boolean(existingSubmission),
          submittedAt: existingSubmission?.submittedAt?.toISOString?.() || null,
          submissionStatus: existingSubmission?.status || null,
        },
        questions: test.questions.map((q: any, idx: number) => ({
          id: q.id,
          number: idx + 1,
          text: q.text,
          marks: q.marks,
          imageUrl: q.imageUrl, // Cloudinary URL
        })),
      };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to fetch test details");
    }
  });

export interface AnswerSubmission {
  questionId: string;
  text?: string;
  imageUrls?: string[]; // Cloudinary URLs
  imagePublicIds?: string[]; // For deletion if needed
}

export interface SubmitAnswersInput {
  token: string;
  testId: string;
  answers: AnswerSubmission[];
}

/**
 * Submit test answers with image support
 */
export const submitTestAnswersServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: SubmitAnswersInput) => data)
  .handler(async ({ data }) => {
    try {
      if (!data.testId || !Array.isArray(data.answers)) {
        throw new Error("Invalid submission data");
      }

      const db = await connectToDatabase();
      const { payload: student } = await requireSession(db, "student", data.token);
      await cleanupExpiredTestsAndImages(db);

      // Verify test exists
      const test = await db
        .collection("tests")
        .findOne({ _id: new ObjectId(data.testId), status: "published" });

      if (!test) {
        throw new Error("Test not found");
      }

      const existingSubmission = await db.collection("submissions").findOne({
        studentId: student.userId,
        testId: new ObjectId(data.testId),
      });

      if (existingSubmission) {
        throw new Error("You have already submitted this test");
      }

      const totalImages = data.answers.reduce(
        (total, answer) => total + (answer.imageUrls?.length || 0),
        0,
      );

      if (totalImages > 2) {
        throw new Error("You can upload a maximum of 2 answer images");
      }

      // Create submission record
      const questionsById = new Map(
        (test.questions || []).map((question: any, index: number) => [
          question.id,
          question.text?.trim() || `Question ${index + 1}`,
        ]),
      );

      const submission = {
        _id: new ObjectId(),
        studentId: student.userId,
        testId: new ObjectId(data.testId),
        imageUrls: data.answers.flatMap((answer) => answer.imageUrls || []),
        imagePublicIds: data.answers.flatMap((answer) => answer.imagePublicIds || []),
        answers: data.answers.map((a) => ({
          questionId: a.questionId,
          questionTitle: questionsById.get(a.questionId) || a.questionId,
          text: a.text || "",
          imageUrls: a.imageUrls || [], // Cloudinary URLs
          imagePublicIds: a.imagePublicIds || [],
        })),
        marks: 0,
        feedback: "",
        submittedAt: new Date(),
        status: "pending",
      };

      const result = await db.collection("submissions").insertOne(submission);

      return {
        ok: true,
        submissionId: result.insertedId.toString(),
        message: "Test submitted successfully",
      };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to submit test");
    }
  });

export const getMySubmissionsServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    try {
      const db = await connectToDatabase();
      const { payload: student } = await requireSession(db, "student", data.token);
      await cleanupExpiredTestsAndImages(db);

      const submissions = await db
        .collection("submissions")
        .aggregate([
          { $match: { studentId: student.userId } },
          {
            $lookup: {
              from: "tests",
              localField: "testId",
              foreignField: "_id",
              as: "test",
            },
          },
          {
            $lookup: {
              from: "admins",
              localField: "evaluatedByAdminId",
              foreignField: "userId",
              as: "evaluator",
            },
          },
          { $sort: { submittedAt: -1 } },
        ])
        .toArray();

      return {
        submissions: submissions.map((submission) => {
          const test = submission.test?.[0];
          const evaluator = submission.evaluator?.[0];
          const questionSummaries = (submission.answers || []).map((answer: any) => {
            const testQuestion = (test?.questions || []).find((question: any) => question.id === answer.questionId);

            return {
              id: answer.questionId,
              title: answer.questionTitle || testQuestion?.text || answer.questionId,
            };
          });

          return {
            id: submission._id.toString(),
            testId: submission.testId?.toString?.() || "",
            testTitle: test?.title || "Untitled test",
            questionIds: questionSummaries.map((question: any) => question.id),
            questions: questionSummaries,
            marks: Number(submission.marks || 0),
            feedback: submission.feedback || "",
            uploadedByAdminId: test?.adminId || "",
            uploadedByAdminName: test?.adminName || test?.adminId || "Admin",
            evaluatedByAdminId: submission.evaluatedByAdminId || "",
            evaluatedByAdminName:
              submission.evaluatedByAdminName ||
              evaluator?.name ||
              submission.evaluatedByAdminId ||
              "",
            status: submission.status || "pending",
            submittedAt: submission.submittedAt?.toISOString?.() || new Date().toISOString(),
            evaluatedAt: submission.evaluatedAt?.toISOString?.() || null,
          };
        }),
      };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to fetch your submissions");
    }
  });

export const getAdminsListServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    try {
      const db = await connectToDatabase();
      await requireSession(db, "student", data.token);
      const admins = await getAllActiveAdmins(db);

      return {
        admins: admins.map((admin) => ({
          id: admin.userId,
          name: admin.name,
        })),
      };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to fetch admins list");
    }
  });

