import { randomUUID } from "node:crypto";
import { EXAM_MODES, type ExamModeId } from "@/lib/exam-modes";
import { planSlots, type SlotPlan } from "@/lib/mcq-profiles";
import { generateMcqSet } from "@/server/mcq-generator.server";

/**
 * In-memory MCQ generation jobs.
 * The browser starts a job (returns instantly), then polls for newly finished questions,
 * so the UI can build the set live and no HTTP request ever sits open for minutes.
 */

export type JobStatus = "running" | "done" | "error" | "cancelled";

export type JobQuestion = {
  slot: number;
  topicId: string;
  topicTitle: string;
  subtopic: string;
  style: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type Job = {
  id: string;
  userId: string;
  total: number;
  status: JobStatus;
  message: string;
  notices: string[];
  questions: JobQuestion[];
  error?: string;
  startedAt: number;
  updatedAt: number;
  cancelledByUser: boolean;
  abort: AbortController;
};

const JOB_MAX_MS = 6 * 60 * 1000;
const JOB_RETENTION_MS = 30 * 60 * 1000;
const MAX_RUNNING_JOBS = 8;

const globalStore = globalThis as unknown as { __examHubMcqJobs?: Map<string, Job> };
const jobs: Map<string, Job> = (globalStore.__examHubMcqJobs ??= new Map());

function sweep() {
  const cutoff = Date.now() - JOB_RETENTION_MS;
  for (const [id, job] of jobs) {
    if (job.status !== "running" && job.updatedAt < cutoff) jobs.delete(id);
  }
}

function touch(job: Job, patch: Partial<Pick<Job, "message" | "status" | "error">>) {
  Object.assign(job, patch);
  job.updatedAt = Date.now();
}

function friendlyFailure(lastError: unknown, fatal?: Error) {
  if (fatal) return fatal.message;
  const text = (lastError instanceof Error ? lastError.message : String(lastError ?? "")).toLowerCase();
  if (text.includes("429") || text.includes("quota") || text.includes("overloaded") || text.includes("unavailable") || text.includes("high demand")) {
    return "The AI service is busy or rate-limited right now. Please wait a minute and try again.";
  }
  if (text.includes("timed out")) {
    return "The AI took too long to respond. Please try again.";
  }
  return "The AI could not produce valid questions this time. Please try again.";
}

async function runJob(job: Job, examModeId: ExamModeId, plan: SlotPlan[], instructions?: string) {
  const killer = setTimeout(() => job.abort.abort(), JOB_MAX_MS);
  let timedOut = false;
  job.abort.signal.addEventListener("abort", () => {
    if (!job.cancelledByUser) timedOut = true;
  });

  try {
    touch(job, { message: "Starting the AI…" });

    const { lastError, fatal } = await generateMcqSet({
      examModeId,
      plan,
      instructions,
      signal: job.abort.signal,
      onQuestion: (question) => {
        const meta = plan[question.slot];
        job.questions.push({
          slot: question.slot,
          topicId: meta.topicId,
          topicTitle: meta.topicTitle,
          subtopic: meta.subtopic,
          style: meta.style,
          prompt: question.prompt,
          options: question.options,
          correctIndex: question.correctIndex,
          explanation: question.explanation,
        });
        touch(job, { message: `${job.questions.length} of ${job.total} questions ready` });
      },
      onStatus: (message) => touch(job, { message }),
      onNotice: (message) => {
        job.notices.push(message);
        job.updatedAt = Date.now();
      },
    });

    if (job.cancelledByUser) {
      touch(job, { status: "cancelled", message: "Stopped. Your finished questions are kept." });
    } else if (job.questions.length === 0) {
      touch(job, { status: "error", error: friendlyFailure(lastError, fatal), message: "Generation failed." });
    } else {
      if (timedOut) job.notices.push("Stopped at the time limit — showing what was generated.");
      touch(job, {
        status: "done",
        message:
          job.questions.length === job.total
            ? `All ${job.total} questions are ready.`
            : `${job.questions.length} of ${job.total} questions are ready.`,
      });
    }
  } catch (error) {
    console.error("[MCQ] job crashed", error);
    if (job.questions.length > 0) {
      touch(job, { status: "done", message: `${job.questions.length} of ${job.total} questions are ready.` });
    } else {
      touch(job, { status: "error", error: friendlyFailure(error), message: "Generation failed." });
    }
  } finally {
    clearTimeout(killer);
  }
}

export function startMcqJob(input: {
  userId: string;
  examModeId: ExamModeId;
  topicIds: string[];
  count: number;
  instructions?: string;
}) {
  sweep();

  // One active set per student: starting a new one stops the previous.
  for (const job of jobs.values()) {
    if (job.userId === input.userId && job.status === "running") {
      job.cancelledByUser = true;
      job.abort.abort();
    }
  }

  const running = [...jobs.values()].filter((job) => job.status === "running").length;
  if (running >= MAX_RUNNING_JOBS) {
    throw new Error("Many students are generating MCQs right now. Please try again in a minute.");
  }

  const plan = planSlots(input.examModeId, input.topicIds, input.count);
  const now = Date.now();
  const job: Job = {
    id: randomUUID(),
    userId: input.userId,
    total: plan.length,
    status: "running",
    message: "Planning your question set…",
    notices: [],
    questions: [],
    startedAt: now,
    updatedAt: now,
    cancelledByUser: false,
    abort: new AbortController(),
  };
  jobs.set(job.id, job);

  void runJob(job, input.examModeId, plan, input.instructions);

  return {
    jobId: job.id,
    total: plan.length,
    examTitle: EXAM_MODES[input.examModeId].title,
    plan: plan.map(({ slot, topicId, topicTitle, subtopic, style }) => ({ slot, topicId, topicTitle, subtopic, style })),
  };
}

export function pollMcqJob(userId: string, jobId: string, cursor: number) {
  sweep();
  const job = jobs.get(jobId);
  if (!job || job.userId !== userId) {
    return {
      found: false,
      status: "error" as JobStatus,
      message: "",
      notices: [] as string[],
      total: 0,
      ready: 0,
      cursor: 0,
      questions: [] as JobQuestion[],
      shortfall: 0,
      error: "This generation session is no longer available (the server may have restarted). Please generate again.",
    };
  }

  const safeCursor = Math.max(0, Math.min(Math.floor(Number(cursor)) || 0, job.questions.length));
  return {
    found: true,
    status: job.status,
    message: job.message,
    notices: job.notices.slice(-3),
    total: job.total,
    ready: job.questions.length,
    cursor: job.questions.length,
    questions: job.questions.slice(safeCursor),
    shortfall: job.status === "running" ? 0 : Math.max(0, job.total - job.questions.length),
    error: job.error,
  };
}

export function cancelMcqJob(userId: string, jobId: string) {
  const job = jobs.get(jobId);
  if (!job || job.userId !== userId || job.status !== "running") return false;
  job.cancelledByUser = true;
  touch(job, { message: "Stopping…" });
  job.abort.abort();
  return true;
}
