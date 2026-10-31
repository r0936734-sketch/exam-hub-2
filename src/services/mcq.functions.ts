import { createServerFn } from "@tanstack/react-start";
import { randomUUID } from "node:crypto";
import { EXAM_MODES, type ExamModeId } from "@/lib/exam-modes";
import { connectToDatabase } from "@/server/db";
import { verifyToken } from "@/server/jwt";
import { cancelMcqJob, pollMcqJob, startMcqJob } from "@/server/mcq-jobs.server";
import { readAuthToken, requireSession } from "@/server/session";

type StartMcqJobInput = {
  token?: string;
  examModeId: string;
  topicIds: string[];
  count: number;
  instructions?: string;
  attemptId?: string;
  slotIndexes?: number[];
};

type PollMcqJobInput = { token?: string; jobId: string; cursor: number };
type CancelMcqJobInput = { token?: string; jobId: string };
type SaveMcqAnswerInput = {
  token?: string;
  attemptId: string;
  questionId: string;
  answerIndex: number;
};

function isValidAttemptId(value: string) {
  return /^[a-zA-Z0-9-]{8,100}$/.test(value);
}

/** Cheap auth for polling: verify the signed token only (no database round-trip per poll). */
function requireStudentId(fallbackToken?: string) {
  const payload = verifyToken(readAuthToken(fallbackToken));
  if (!payload || payload.role !== "student") {
    throw new Error("Forbidden - your session has expired. Please sign in again.");
  }
  return payload.userId;
}

/** Starts generation and returns immediately; questions are fetched with pollMcqJobServerFn. */
export const startMcqJobServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: StartMcqJobInput) => data)
  .handler(async ({ data }) => {
    const db = await connectToDatabase();
    const session = await requireSession(db, "student", data.token);

    const mode = EXAM_MODES[data.examModeId as ExamModeId];
    if (!mode || mode.format !== "objective") {
      throw new Error("MCQ practice is available for DSSSB TGT CS and UGC NET CS only.");
    }

    const validTopicIds = new Set(mode.syllabus.map((topic) => topic.id));
    const topicIds = Array.isArray(data.topicIds)
      ? [...new Set(data.topicIds.filter((id) => typeof id === "string" && validTopicIds.has(id)))]
      : [];
    if (!topicIds.length) throw new Error("Select at least one topic.");

    const count = Math.floor(Number(data.count));
    if (!Number.isFinite(count) || count < 1 || count > 50) {
      throw new Error("Choose between 1 and 50 questions.");
    }

    const instructions =
      typeof data.instructions === "string" && data.instructions.trim()
        ? data.instructions.trim().slice(0, 400)
        : undefined;

    const userId = session.user.id;
    const attemptId = data.attemptId ? String(data.attemptId) : randomUUID();
    let attempt: any;
    const isNewAttempt = !data.attemptId;

    if (!isValidAttemptId(attemptId)) throw new Error("Invalid MCQ practice session.");

    if (isNewAttempt) {
      await db.collection("mcq_practice_attempts").updateMany(
        { userId, status: "in_progress" },
        { $set: { status: "abandoned", updatedAt: new Date() } },
      );
      attempt = {
        userId,
        attemptId,
        examModeId: mode.id,
        topicIds,
        questionCount: count,
        instructions,
        questions: {},
        slotMeta: {},
        answers: {},
        status: "in_progress",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.collection("mcq_practice_attempts").insertOne(attempt);
    } else {
      attempt = await db.collection("mcq_practice_attempts").findOne({
        userId,
        attemptId,
        status: "in_progress",
      });
      if (!attempt || attempt.examModeId !== mode.id) {
        throw new Error("This MCQ practice session is no longer available.");
      }
    }

    const slotIndexes =
      Array.isArray(data.slotIndexes) && data.slotIndexes.length
        ? data.slotIndexes.map((slot) => Math.floor(Number(slot)))
        : Array.from({ length: count }, (_, index) => index);
    if (
      slotIndexes.length !== count ||
      new Set(slotIndexes).size !== count ||
      slotIndexes.some((slot) => !Number.isInteger(slot) || slot < 0 || slot >= attempt.questionCount)
    ) {
      if (isNewAttempt) await db.collection("mcq_practice_attempts").deleteOne({ userId, attemptId });
      throw new Error("Invalid question slots for this MCQ practice session.");
    }
    if (slotIndexes.some((slot) => attempt.questions?.[String(slot)])) {
      throw new Error("Questions are already generated for one or more requested slots.");
    }

    let startedJobId: string | undefined;
    try {
      const started = startMcqJob({
        userId,
        attemptId,
        slotIndexes,
        examModeId: mode.id,
        topicIds,
        count,
        instructions,
      });
      startedJobId = started.jobId;

      const planUpdates = Object.fromEntries(
        started.plan.map((entry, index) => [String(slotIndexes[index]), entry]),
      );
      await db.collection("mcq_practice_attempts").updateOne(
        { userId, attemptId, status: "in_progress" },
        {
          $set: {
            ...Object.fromEntries(
              Object.entries(planUpdates).map(([slot, entry]) => [`slotMeta.${slot}`, entry]),
            ),
            updatedAt: new Date(),
          },
        },
      );
      return started;
    } catch (error) {
      if (startedJobId) cancelMcqJob(userId, startedJobId);
      if (isNewAttempt) {
        await db.collection("mcq_practice_attempts").deleteOne({ userId, attemptId });
      }
      throw error;
    }
  });

export const pollMcqJobServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: PollMcqJobInput) => data)
  .handler(async ({ data }) => {
    const userId = requireStudentId(data.token);
    const result = pollMcqJob(userId, String(data.jobId || ""), Number(data.cursor) || 0);
    if (result.found && result.questions.length) {
      const db = await connectToDatabase();
      const updates = Object.fromEntries(
        result.questions.flatMap((question) => {
          const slot = result.slotIndexes[question.slot];
          return [
            [
              `questions.${slot}`,
              {
                ...question,
                id: `${data.jobId}-${question.slot}`,
                slot,
              },
            ],
            [
              `slotMeta.${slot}`,
              {
                slot,
                topicId: question.topicId,
                topicTitle: question.topicTitle,
                subtopic: question.subtopic,
                style: question.style,
              },
            ],
          ];
        }),
      );
      const saved = await db.collection("mcq_practice_attempts").updateOne(
        { userId, attemptId: result.attemptId, status: "in_progress" },
        { $set: { ...updates, updatedAt: new Date() } },
      );
      if (!saved.matchedCount) throw new Error("Could not save generated questions for this practice session.");
    }
    return result;
  });

export const cancelMcqJobServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: CancelMcqJobInput) => data)
  .handler(async ({ data }) => {
    const userId = requireStudentId(data.token);
    return { cancelled: cancelMcqJob(userId, String(data.jobId || "")) };
  });

export const getActiveMcqAttemptServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string; examModeId: string }) => data)
  .handler(async ({ data }) => {
    const userId = requireStudentId(data.token);
    const mode = EXAM_MODES[data.examModeId as ExamModeId];
    if (!mode || mode.format !== "objective") {
      throw new Error("MCQ practice is available for DSSSB TGT CS and UGC NET CS only.");
    }

    const db = await connectToDatabase();
    const attempt = await db.collection("mcq_practice_attempts").findOne(
      { userId, examModeId: mode.id, status: "in_progress" },
      { sort: { updatedAt: -1 } },
    );
    if (!attempt) return { attempt: null };

    const questions = Array.from({ length: attempt.questionCount }, (_, slot) => {
      const question = attempt.questions?.[String(slot)];
      return question ? { ...question, slot } : null;
    });
    const plan = Array.from({ length: attempt.questionCount }, (_, slot) => {
      const entry = attempt.slotMeta?.[String(slot)];
      return entry ? { ...entry, slot } : null;
    });

    return {
      attempt: {
        attemptId: attempt.attemptId,
        examModeId: attempt.examModeId,
        topicIds: attempt.topicIds,
        questionCount: attempt.questionCount,
        instructions: attempt.instructions || "",
        questions,
        plan,
        answers: attempt.answers || {},
      },
    };
  });

export const saveMcqAnswerServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: SaveMcqAnswerInput) => data)
  .handler(async ({ data }) => {
    const userId = requireStudentId(data.token);
    if (!isValidAttemptId(data.attemptId) || !/^[a-zA-Z0-9-]{8,120}$/.test(data.questionId)) {
      throw new Error("Invalid MCQ practice session.");
    }
    if (!Number.isInteger(data.answerIndex) || data.answerIndex < 0 || data.answerIndex > 3) {
      throw new Error("Select a valid answer option.");
    }

    const db = await connectToDatabase();
    const attempt = await db.collection("mcq_practice_attempts").findOne({
      userId,
      attemptId: data.attemptId,
      status: "in_progress",
    });
    const savedQuestions = Object.values(
      (attempt?.questions || {}) as Record<string, { id?: string }>,
    );
    const ownsQuestion = savedQuestions.some((question) => question.id === data.questionId);
    if (!attempt || !ownsQuestion) throw new Error("This MCQ practice session is no longer available.");

    const saved = await db.collection("mcq_practice_attempts").updateOne(
      { userId, attemptId: data.attemptId, status: "in_progress" },
      { $set: { [`answers.${data.questionId}`]: data.answerIndex, updatedAt: new Date() } },
    );
    if (!saved.matchedCount) throw new Error("Could not save your answer.");
    return { ok: true };
  });

export const submitMcqAttemptServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { token?: string; attemptId: string; answers: Record<string, number> }) => data)
  .handler(async ({ data }) => {
    const userId = requireStudentId(data.token);
    if (!isValidAttemptId(data.attemptId)) throw new Error("Invalid MCQ practice session.");

    const db = await connectToDatabase();
    const collection = db.collection("mcq_practice_attempts");
    const attempt = await collection.findOne({
      userId,
      attemptId: data.attemptId,
      status: "in_progress",
    });
    if (!attempt) throw new Error("This MCQ practice session is no longer available.");

    const questions = Object.values(attempt.questions || {}) as Array<{ id: string; correctIndex: number }>;
    if (!questions.length) throw new Error("Generate at least one question before submitting.");
    const answers = data.answers;
    if (
      questions.some(
        (question) =>
          !Number.isInteger(answers[question.id]) || answers[question.id] < 0 || answers[question.id] > 3,
      )
    ) {
      throw new Error("Answer every generated question before submitting.");
    }
    if (Object.keys(answers).some((questionId) => !questions.some((question) => question.id === questionId))) {
      throw new Error("The submitted answers do not match this practice session.");
    }
    const score = questions.reduce(
      (total, question) => total + Number(answers[question.id] === question.correctIndex),
      0,
    );
    const submittedAt = new Date();
    const saved = await collection.updateOne(
      { userId, attemptId: data.attemptId, status: "in_progress" },
      {
        $set: {
          status: "submitted",
          answers,
          score,
          submittedQuestionCount: questions.length,
          submittedAt,
          updatedAt: submittedAt,
        },
      },
    );
    if (!saved.matchedCount) throw new Error("This MCQ practice session has already been submitted.");
    return { ok: true, score, total: questions.length };
  });
