import { createServerFn } from "@tanstack/react-start";
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
};

type PollMcqJobInput = { token?: string; jobId: string; cursor: number };
type CancelMcqJobInput = { token?: string; jobId: string };

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

    return startMcqJob({
      userId: session.user.id,
      examModeId: mode.id,
      topicIds,
      count,
      instructions,
    });
  });

export const pollMcqJobServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: PollMcqJobInput) => data)
  .handler(async ({ data }) => {
    const userId = requireStudentId(data.token);
    return pollMcqJob(userId, String(data.jobId || ""), Number(data.cursor) || 0);
  });

export const cancelMcqJobServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: CancelMcqJobInput) => data)
  .handler(async ({ data }) => {
    const userId = requireStudentId(data.token);
    return { cancelled: cancelMcqJob(userId, String(data.jobId || "")) };
  });
