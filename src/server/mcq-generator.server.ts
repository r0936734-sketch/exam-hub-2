import { GoogleGenAI } from "@google/genai";
import { EXAM_MODES, type ExamModeId } from "@/lib/exam-modes";
import { EXAM_PROFILES, STYLE_RULES, type SlotPlan } from "@/lib/mcq-profiles";

/**
 * Streaming MCQ generator.
 *
 * - Each configured model gets a 10-question batch at the same time.
 * - The model that returns a valid question first claims the first available 10-question
 *   display block, so a slow model can never hold up questions 1–10.
 * - The model streams a JSON array; every COMPLETE question object is validated on the spot and
 *   handed to `onQuestion` immediately, so the UI can build the page live.
 * - A bad question never fails the batch: only the missing slots are retried (alternating models).
 */

const MCQ_MODELS = ["gemma-4-31b-it", "gemma-4-26b-a4b-it"] as const;
const BATCH_SIZE = 10;
const MAX_ATTEMPTS = 3;
const START_TIMEOUT_MS = 12_000;
const FIRST_CHUNK_TIMEOUT_MS = 30_000;
const CHUNK_TIMEOUT_MS = 20_000;

export class FatalMcqError extends Error {}

let aiClient: GoogleGenAI | null = null;
function getAi() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new FatalMcqError("The AI service is not configured. Please contact the administrator.");
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export type AcceptedMcq = {
  slot: number;
  /** Original planned slot. The display slot can change when another provider wins the race. */
  sourceSlot: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type RunContext = {
  plan: SlotPlan[];
  examModeId: ExamModeId;
  instructions?: string;
  signal: AbortSignal;
  filled: Set<number>;
  seenStems: string[];
  lastError?: unknown;
  fatal?: FatalMcqError;
  onQuestion: (question: AcceptedMcq) => void;
  onStatus: (message: string) => void;
  onNotice: (message: string) => void;
};

/* ------------------------------ small helpers ---------------------------- */

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

function isRateLimited(error: unknown) {
  const e = error as { status?: number; statusCode?: number } | null;
  const message = errorText(error).toLowerCase();
  return (
    e?.status === 429 ||
    e?.statusCode === 429 ||
    e?.status === 503 ||
    message.includes("429") ||
    message.includes("quota") ||
    message.includes("overloaded") ||
    message.includes("unavailable") ||
    message.includes("high demand")
  );
}

function isFatal(error: unknown) {
  if (error instanceof FatalMcqError) return true;
  const e = error as { status?: number; statusCode?: number } | null;
  const message = errorText(error).toLowerCase();
  return (
    e?.status === 401 ||
    e?.status === 403 ||
    message.includes("api key not valid") ||
    message.includes("api_key_invalid") ||
    message.includes("permission denied")
  );
}

/** Parse a JSON object; repair the usual LLM slips (raw newlines in strings, bad backslashes). */
function tolerantParse(source: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(source);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    // fall through to repair
  }

  let out = "";
  let inString = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (!inString) {
      out += ch;
      if (ch === '"') inString = true;
      continue;
    }
    if (ch === "\\") {
      const next = source[i + 1];
      if (next !== undefined && /["\\/bfnrt]/.test(next)) {
        out += ch + next;
        i += 1;
      } else if (next === "u" && /^[0-9a-fA-F]{4}$/.test(source.slice(i + 2, i + 6))) {
        out += source.slice(i, i + 6);
        i += 5;
      } else {
        out += "\\\\";
      }
      continue;
    }
    if (ch === '"') {
      inString = false;
      out += ch;
    } else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") continue;
    else out += ch;
  }

  try {
    const parsed = JSON.parse(out);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Incrementally pulls COMPLETE top-level objects out of a streaming JSON array. */
function createObjectExtractor() {
  let buffer = "";
  let scan = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;

  return {
    push(chunk: string): Record<string, unknown>[] {
      buffer += chunk;
      const found: Record<string, unknown>[] = [];

      if (scan < 0) {
        const match = /\[\s*\{/.exec(buffer);
        if (!match) return found;
        scan = match.index + 1;
      }

      for (; scan < buffer.length; scan += 1) {
        const ch = buffer[scan];
        if (inString) {
          if (escaped) escaped = false;
          else if (ch === "\\") escaped = true;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') {
          if (depth > 0) inString = true;
          continue;
        }
        if (ch === "{") {
          if (depth === 0) start = scan;
          depth += 1;
        } else if (ch === "}" && depth > 0) {
          depth -= 1;
          if (depth === 0 && start >= 0) {
            const parsed = tolerantParse(buffer.slice(start, scan + 1));
            if (parsed) found.push(parsed);
            start = -1;
          }
        }
      }
      return found;
    },
  };
}

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const stripOptionLabel = (value: string) =>
  value.replace(/^\s*\(?[A-Da-d][\).:]\s+/, "").replace(/\s+/g, " ").trim();
const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, " ").trim();

function wordSet(value: string) {
  // \p{M} keeps Devanagari (Hindi) vowel signs attached to their words.
  return new Set(normalize(value).split(/[^\p{L}\p{M}\p{N}]+/u).filter((word) => word.length > 2));
}

function isNearDuplicate(prompt: string, seen: string[]) {
  const words = wordSet(prompt);
  if (words.size < 4) return false;
  return seen.some((other) => {
    const otherWords = wordSet(other);
    let shared = 0;
    words.forEach((word) => {
      if (otherWords.has(word)) shared += 1;
    });
    return shared / (words.size + otherWords.size - shared || 1) > 0.78;
  });
}

/* ------------------------------ validation ------------------------------- */

type Validation = { ok: true; question: AcceptedMcq } | { ok: false; reason: string };

function resolveCorrectIndex(raw: Record<string, unknown>, options: string[]): number {
  const answer = typeof raw.correctAnswer === "string" ? raw.correctAnswer.trim() : "";
  const normalizedOptions = options.map(normalize);

  if (answer) {
    const exact = normalizedOptions.indexOf(normalize(stripOptionLabel(answer)));
    if (exact >= 0) return exact;

    const letter = answer.match(/^(?:option\s*)?\(?([A-Da-d])\)?(?:[\).:]|$)/i);
    if (letter && answer.length <= 12) return letter[1].toUpperCase().charCodeAt(0) - 65;
  }

  const numeric = Number(raw.correctIndex);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 3) return numeric;
  return -1;
}

function validateQuestion(raw: Record<string, unknown>, plan: SlotPlan, ctx: RunContext): Validation {
  const prompt = typeof raw.question === "string" ? raw.question.trim() : "";
  const explanation = typeof raw.explanation === "string" ? raw.explanation.trim() : "";
  const options = Array.isArray(raw.options)
    ? raw.options.map((option) => (typeof option === "string" ? stripOptionLabel(option) : ""))
    : [];

  if (prompt.length < 12) return { ok: false, reason: "question too short" };
  if (options.length !== 4 || options.some((option) => !option)) return { ok: false, reason: "needs exactly 4 options" };
  if (new Set(options.map(normalize)).size !== 4) return { ok: false, reason: "duplicate options" };
  if (explanation.length < 15) return { ok: false, reason: "missing explanation" };
  if (/(all|none) of (the )?(above|these)/i.test(options.join(" | "))) {
    return { ok: false, reason: "all/none-of-the-above option" };
  }

  const correctIdx = resolveCorrectIndex(raw, options);
  if (correctIdx < 0 || correctIdx > 3) return { ok: false, reason: "correct answer not found in options" };

  // Answer-length cue: the right option must not stand out as far longer than the distractors.
  const distractorLengths = options.filter((_, i) => i !== correctIdx).map((option) => option.length);
  const avgDistractor = distractorLengths.reduce((a, b) => a + b, 0) / distractorLengths.length;
  if (options[correctIdx].length > 25 && options[correctIdx].length > avgDistractor * 2.4) {
    return { ok: false, reason: "answer-length cue" };
  }

  if (isNearDuplicate(prompt, ctx.seenStems)) return { ok: false, reason: "duplicate of an earlier question" };

  const correctOption = options[correctIdx];
  let finalOptions: string[];
  let finalIndex: number;

  if (plan.style === "assertion") {
    // Standard A–R option order is conventional; keep what the model produced.
    finalOptions = options;
    finalIndex = correctIdx;
  } else {
    finalOptions = shuffle(options.filter((_, i) => i !== correctIdx));
    finalIndex = Math.min(3, Math.max(0, plan.targetIndex));
    finalOptions.splice(finalIndex, 0, correctOption);
  }

  return {
    ok: true,
    question: {
      slot: plan.slot,
      sourceSlot: plan.slot,
      prompt,
      options: finalOptions,
      correctIndex: finalIndex,
      explanation,
    },
  };
}

/* -------------------------------- prompting ------------------------------ */

function buildPrompt(ctx: RunContext, pending: SlotPlan[]): string {
  const mode = EXAM_MODES[ctx.examModeId];
  const profile = EXAM_PROFILES[ctx.examModeId]!;

  const slotLines = pending
    .map(
      (p) =>
        `Q${p.slot + 1} — topic: ${p.topicTitle} | subtopic: ${p.subtopic} | style: ${p.style}\n   ${STYLE_RULES[p.style]}`,
    )
    .join("\n");

  const topicNotes = [...new Set(pending.map((p) => p.topicId))]
    .map((id) => {
      const topic = mode.syllabus.find((t) => t.id === id);
      const note = topic ? profile.topicNote(topic) : "";
      return note && topic ? `- ${topic.title}: ${note}` : "";
    })
    .filter(Boolean)
    .join("\n");

  const extra = ctx.instructions?.trim().slice(0, 400);

  return `You are a ${profile.persona}.

EXAM: ${mode.title}
STANDARD: ${profile.standard}

Write exactly ${pending.length} multiple-choice question${pending.length === 1 ? "" : "s"}, one for each numbered slot below. Each question must test its assigned subtopic in its assigned style. If two slots share a subtopic, they must test DIFFERENT concepts.

SLOTS:
${slotLines}
${topicNotes ? `\nTOPIC NOTES:\n${topicNotes}\n` : ""}${extra ? `\nSTUDENT PREFERENCE (follow only if it fits the slots above): ${extra}\n` : ""}
NON-NEGOTIABLE RULES:
1. Exactly four options, plain text WITHOUT "A)", "B)" labels, exactly ONE correct. Options must be concise, mutually distinct and plausible.
2. Never use "all of the above", "none of the above" or trick wording.
3. Keep option lengths comparable; the correct option must not be conspicuously longer or more detailed.
4. Do not put the answer position in a pattern; just write the correct option naturally.
5. In one or two concise sentences, explain why the correct option is right and why the most tempting wrong option fails.
6. Self-contained: include every number, table or code snippet needed inside the question.
7. Use plain text and Unicode symbols (×, ÷, ≤, ≥, ≈, ∑, →). Do NOT use LaTeX or $ delimiters.
8. Inside JSON strings, write line breaks as \\n and escape quotes properly.
${ctx.examModeId === "ugc-net-cs" ? "9. Difficulty: genuine UGC NET level — avoid one-line definition recall unless the style is 'concept' and the distinction is subtle.\n" : "9. Difficulty: genuine DSSSB level — fair but not trivial.\n"}${profile.rules.map((rule, index) => `${10 + index}. ${rule}`).join("\n")}

OUTPUT FORMAT — return ONLY a JSON array, starting immediately with "[" (no preface, no markdown fences, no commentary). One object per slot, in slot order, with exactly these keys:
{"n": <slot number, e.g. ${pending[0].slot + 1}>, "question": "...", "options": ["...", "...", "...", "..."], "correctAnswer": "<exact text of the correct option>", "explanation": "..."}`;
}

/* ------------------------------- generation ------------------------------ */

async function streamAttempt(
  ctx: RunContext,
  model: string,
  pending: SlotPlan[],
  onAccepted: (question: AcceptedMcq) => void,
) {
  const prompt = buildPrompt(ctx, pending);
  const bySlotNumber = new Map(pending.map((p) => [p.slot + 1, p]));
  const attemptAbort = new AbortController();
  const forwardAbort = () => attemptAbort.abort();
  ctx.signal.addEventListener("abort", forwardAbort);

  let iterator: AsyncGenerator<{ text?: string }> | undefined;
  const extractor = createObjectExtractor();
  let position = 0;
  let rejected = 0;

  const accept = (raw: Record<string, unknown>) => {
    const n = Number(raw.n);
    let plan = Number.isInteger(n) ? bySlotNumber.get(n) : undefined;
    if (!plan || ctx.filled.has(plan.slot)) plan = pending[position];
    position += 1;
    if (!plan || ctx.filled.has(plan.slot)) return;

    const result = validateQuestion(raw, plan, ctx);
    if (!result.ok) {
      rejected += 1;
      console.warn(`[MCQ] rejected Q${plan.slot + 1} (${model}): ${result.reason}`);
      return;
    }
    ctx.filled.add(plan.slot);
    ctx.seenStems.push(result.question.prompt);
    onAccepted(result.question);
  };

  try {
    const response = await withTimeout(
      getAi().models.generateContentStream({
        model,
        contents: [{ role: "user" as const, parts: [{ text: prompt }] }],
        config: { temperature: 0.8, abortSignal: attemptAbort.signal },
      }),
      START_TIMEOUT_MS,
      `MCQ generation timed out while starting ${model}`,
    );
    iterator = response as unknown as AsyncGenerator<{ text?: string }>;

    let gotFirstChunk = false;
    while (true) {
      const chunk = await withTimeout(
        iterator.next(),
        gotFirstChunk ? CHUNK_TIMEOUT_MS : FIRST_CHUNK_TIMEOUT_MS,
        `MCQ generation timed out while streaming from ${model}`,
      );
      if (chunk.done) break;
      gotFirstChunk = true;
      const text = chunk.value.text;
      if (text) for (const raw of extractor.push(text)) accept(raw);
    }
  } finally {
    ctx.signal.removeEventListener("abort", forwardAbort);
    attemptAbort.abort();
    try {
      await iterator?.return?.(undefined);
    } catch {
      // best-effort stream cleanup
    }
  }

  if (rejected > 0) console.info(`[MCQ] ${model}: ${rejected} question(s) failed quality checks in this attempt`);
}

async function runGroup(
  ctx: RunContext,
  group: SlotPlan[],
  preferredModelIndex: number,
  reserveDisplayBlock: (size: number) => number,
) {
  const label =
    group.length === 1 ? `question ${group[0].slot + 1}` : `questions ${group[0].slot + 1}–${group[group.length - 1].slot + 1}`;

  let displayStart: number | undefined;
  const emitQuestion = (question: AcceptedMcq) => {
    // Reserve a contiguous block only after a provider has produced a valid question.
    // The first responsive provider therefore owns questions 1–10.
    if (displayStart === undefined) displayStart = reserveDisplayBlock(group.length);
    const position = group.findIndex((plan) => plan.slot === question.sourceSlot);
    if (position < 0) return;
    ctx.onQuestion({ ...question, slot: displayStart + position });
  };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    if (ctx.signal.aborted || ctx.fatal) return;
    const pending = group.filter((p) => !ctx.filled.has(p.slot));
    if (!pending.length) return;

    // Each initial lane starts on a different model; retries immediately rotate providers.
    const model = MCQ_MODELS[(preferredModelIndex + attempt) % MCQ_MODELS.length];
    ctx.onStatus(attempt === 0 ? `Writing ${label}…` : `Retrying ${pending.length} question${pending.length === 1 ? "" : "s"} (${label})…`);

    try {
      await streamAttempt(ctx, model, pending, emitQuestion);
    } catch (error) {
      if (ctx.signal.aborted) return;
      ctx.lastError = error;
      console.warn(`[MCQ] attempt ${attempt + 1} failed with ${model}`, error);

      if (isFatal(error)) {
        ctx.fatal = error instanceof FatalMcqError ? error : new FatalMcqError("The AI service rejected the request. Please contact the administrator.");
        return;
      }

      if (attempt < MAX_ATTEMPTS - 1) {
        ctx.onNotice(
          isRateLimited(error)
            ? "The AI is busy right now — switching model and retrying…"
            : "Hit a snag — retrying with the backup model…",
        );
        await sleep(isRateLimited(error) ? 500 * (attempt + 1) : 250);
      }
    }
  }
}

export async function generateMcqSet(args: {
  examModeId: ExamModeId;
  plan: SlotPlan[];
  instructions?: string;
  signal: AbortSignal;
  onQuestion: (question: AcceptedMcq) => void;
  onStatus: (message: string) => void;
  onNotice: (message: string) => void;
}): Promise<{ lastError?: unknown; fatal?: Error }> {
  if (!EXAM_PROFILES[args.examModeId]) throw new Error("This exam mode does not support MCQ practice.");

  const ctx: RunContext = {
    plan: args.plan,
    examModeId: args.examModeId,
    instructions: args.instructions,
    signal: args.signal,
    filled: new Set(),
    seenStems: [],
    onQuestion: args.onQuestion,
    onStatus: args.onStatus,
    onNotice: args.onNotice,
  };

  const groups: SlotPlan[][] = [];
  for (let i = 0; i < args.plan.length; i += BATCH_SIZE) groups.push(args.plan.slice(i, i + BATCH_SIZE));

  const queue = [...groups];
  let nextDisplaySlot = 0;
  const reserveDisplayBlock = (size: number) => {
    const start = nextDisplaySlot;
    nextDisplaySlot += size;
    return start;
  };

  // One worker per configured model starts immediately. Any extra batch is picked up by
  // whichever provider finishes first.
  const workers = Array.from({ length: Math.min(MCQ_MODELS.length, queue.length) }, async (_, workerIndex) => {
    while (queue.length && !ctx.signal.aborted && !ctx.fatal) {
      const group = queue.shift();
      if (group) await runGroup(ctx, group, workerIndex, reserveDisplayBlock);
    }
  });
  await Promise.all(workers);

  return { lastError: ctx.lastError, fatal: ctx.fatal };
}
