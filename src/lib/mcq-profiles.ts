import { EXAM_MODES, type ExamModeId, type ExamTopic } from "@/lib/exam-modes";

/**
 * Exam-specific MCQ logic for DSSSB TGT CS and UGC NET CS.
 * Pure data + planning helpers (safe to import on both client and server).
 */

export type McqStyleId =
  | "concept"
  | "application"
  | "statements"
  | "match"
  | "assertion"
  | "trace"
  | "fill"
  | "scenario"
  | "ordering";

export const STYLE_LABELS: Record<McqStyleId, string> = {
  concept: "Concept",
  application: "Application",
  statements: "Statement type",
  match: "Match the following",
  assertion: "Assertion–Reason",
  trace: "Trace / calculate",
  fill: "Identify / complete",
  scenario: "Scenario",
  ordering: "Sequence",
};

export const STYLE_RULES: Record<McqStyleId, string> = {
  concept:
    "Direct conceptual question with exactly one defensible answer. Distractors must be genuine misconceptions, not nonsense.",
  application:
    "Short applied problem or situation where the concept must be APPLIED (not merely recalled).",
  statements:
    "Statement type: write 3 numbered statements (I, II, III), each on its own line (separate lines with \\n), then ask which statement(s) is/are correct (or incorrect). The four options must be four DIFFERENT combinations such as 'I and II only', 'II and III only', 'I, II and III', 'I only'.",
  match:
    "Match-the-following: 'List-I' and 'List-II' with four items each (A–D and I–IV), one item per line (use \\n). The four options must be four DIFFERENT mappings such as 'A-II, B-I, C-IV, D-III'. Exactly one mapping is fully correct.",
  assertion:
    "Assertion–Reason: 'Assertion (A): ...\\nReason (R): ...'. Use exactly these four options in this order: 'Both A and R are true and R is the correct explanation of A' / 'Both A and R are true but R is NOT the correct explanation of A' / 'A is true but R is false' / 'A is false but R is true'.",
  trace:
    "Computation / trace / output-prediction with ALL data given in the question (numbers, table, short code). Solve it yourself step by step first; the correct option must equal your result. Distractors are typical wrong results (off-by-one, wrong formula, skipped step).",
  fill:
    "Identify-the-correct/incorrect or fill-in-the-blank item with one clear answer.",
  scenario:
    "Realistic classroom or real-life scenario ending in a question with one best answer.",
  ordering:
    "Arrange-in-correct-order question (steps / phases / layers / sequence). The four options are four DIFFERENT sequences, e.g. 'B, A, D, C'.",
};

export type SlotPlan = {
  slot: number;
  topicId: string;
  topicTitle: string;
  subtopic: string;
  style: McqStyleId;
  /** Index (0-3) where the correct option must land after shuffling. */
  targetIndex: number;
};

export type ExamProfile = {
  persona: string;
  standard: string;
  rules: string[];
  stylesFor: (topic: ExamTopic) => McqStyleId[];
  topicNote: (topic: ExamTopic) => string;
};

/* ----------------------------- DSSSB TGT CS ----------------------------- */

const DSSSB_TRACE_FRIENDLY = new Set([
  "dsssb-fundamentals",
  "dsssb-digital-logic",
  "dsssb-architecture",
  "dsssb-os",
  "dsssb-programming",
  "dsssb-oop",
  "dsssb-ds",
  "dsssb-algorithms",
  "dsssb-dbms",
  "dsssb-networks",
  "dsssb-toc",
  "dsssb-numerical",
]);

const CODE_NOTE =
  "If code is shown keep it under 10 lines, put it inside a ``` fenced block, use \\n for line breaks inside the JSON string, state the language, and make sure the output is deterministic.";

const DSSSB_PROFILE: ExamProfile = {
  persona: "senior DSSSB TGT (Computer Science) Tier-II question-paper setter",
  standard:
    "DSSSB TGT Computer Science level: moderate to difficult. Section A (general) follows the SSC/DSSSB pattern; Section B (Computer Science) is graduation level (B.Sc / BCA / B.Tech) mixing factual, conceptual, short numerical and code-output items. No question may depend on a diagram or image.",
  rules: [
    "Every fact must be correct per standard textbooks; if you are not sure about a fact, pick a different question.",
    "Numerical or logical items: solve them yourself first and make the correct option equal your exact result.",
  ],
  stylesFor: (topic) => {
    switch (topic.id) {
      case "dsssb-awareness":
        return ["concept", "fill", "statements", "concept"];
      case "dsssb-reasoning":
        return ["application"];
      case "dsssb-arithmetic":
        return ["trace"];
      case "dsssb-hindi":
      case "dsssb-english":
        return ["fill", "concept", "application"];
      case "dsssb-pedagogy":
        return ["scenario", "concept", "statements", "scenario"];
      default:
        return DSSSB_TRACE_FRIENDLY.has(topic.id)
          ? ["concept", "application", "trace", "statements", "fill", "concept"]
          : ["concept", "application", "statements", "fill", "concept"];
    }
  },
  topicNote: (topic) => {
    switch (topic.id) {
      case "dsssb-awareness":
        return "General Awareness: ask ONLY stable, widely verifiable facts (static GK, polity, history, geography, science, Delhi facts you are certain about). Do NOT ask about events of the last 12 months or anything time-sensitive. Never invent names, dates or figures.";
      case "dsssb-reasoning":
        return "Reasoning: text-only puzzles (series, coding-decoding, blood relations, ranking, syllogism, seating). Specify ALL data, make sure exactly one option is valid, and verify by solving it.";
      case "dsssb-arithmetic":
        return "Quantitative aptitude: clean numbers, careful arithmetic. Show the working in the explanation; distractors are typical slip answers.";
      case "dsssb-hindi":
        return "Hindi: write the question, all options and the explanation entirely in Hindi (Devanagari). Follow standard Hindi vyakaran; each item must have exactly one defensible answer.";
      case "dsssb-english":
        return "English: self-contained items (grammar, error spotting, vocabulary, voice/narration, cloze). Exactly one defensible answer per standard grammar (Wren & Martin). For comprehension, include a short 3–4 line passage inside the question.";
      case "dsssb-pedagogy":
        return "Pedagogy: base items on NEP 2020, NCF, RTE Act 2009, Piaget, Vygotsky, Kohlberg, Bruner, Bloom's taxonomy, Gagné, inclusive education, CCE and ICT in teaching. Classroom scenarios are welcome.";
      case "dsssb-emerging":
        return "Emerging topics: stick to well-established concepts; avoid claims about recent products, versions or news.";
      case "dsssb-programming":
      case "dsssb-oop":
        return CODE_NOTE;
      default:
        return "";
    }
  },
};

/* ------------------------------- UGC NET CS ------------------------------ */

const UGC_COMPUTATIONAL = new Set([
  "ugc-discrete",
  "ugc-architecture",
  "ugc-programming-graphics",
  "ugc-dbms",
  "ugc-system-os",
  "ugc-ds-algorithms",
  "ugc-toc-compilers",
  "ugc-networks",
]);
const UGC_SEQUENCE_FRIENDLY = new Set([
  "ugc-system-os",
  "ugc-software-engineering",
  "ugc-toc-compilers",
  "ugc-networks",
]);

const UGC_PROFILE: ExamProfile = {
  persona: "senior NTA UGC NET Computer Science & Applications (Paper-II) question-paper setter",
  standard:
    "Real UGC NET Paper-II level: analytical and multi-step, testing understanding and application rather than trivia. At least half of the questions must need reasoning, tracing or comparison. Use precise terminology from standard texts (Cormen, Silberschatz, Korth, Tanenbaum, Hennessy-Patterson, Aho-Ullman, Pressman, Russell-Norvig).",
  rules: [
    "Every statement must be technically correct per standard textbooks; if unsure, choose a different question.",
    "Numerical / trace items: solve them yourself step by step first; the correct option must equal your result.",
    "Distractors must come from realistic errors (off-by-one, wrong formula, swapped terms, partially true statements).",
  ],
  stylesFor: (topic) => {
    const base: McqStyleId[] = [
      "concept",
      "statements",
      UGC_COMPUTATIONAL.has(topic.id) ? "trace" : "application",
      "match",
      "assertion",
      "application",
      "statements",
      "concept",
    ];
    if (UGC_SEQUENCE_FRIENDLY.has(topic.id)) base.splice(5, 0, "ordering");
    return base;
  },
  topicNote: (topic) => {
    switch (topic.id) {
      case "ugc-discrete":
        return "Double-check every counting, probability and group-theory result before using it as the answer.";
      case "ugc-programming-graphics":
      case "ugc-ds-algorithms":
      case "ugc-system-os":
        return CODE_NOTE;
      case "ugc-ai":
        return "AI: use established textbook definitions and algorithms (search, logic, ML basics, NLP); avoid claims about recent models or products.";
      default:
        return "";
    }
  },
};

export const EXAM_PROFILES: Partial<Record<ExamModeId, ExamProfile>> = {
  "dsssb-tgt-cs": DSSSB_PROFILE,
  "ugc-net-cs": UGC_PROFILE,
};

/* ------------------------------ Slot planning ---------------------------- */

function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Balanced A–D target plan, shuffled, with no run of three identical answers. */
export function balancedAnswerPlan(count: number): number[] {
  const plan = shuffle(Array.from({ length: count }, (_, i) => i % 4));
  for (let attempt = 0; attempt < 300; attempt += 1) {
    let bad = -1;
    for (let i = 2; i < plan.length; i += 1) {
      if (plan[i] === plan[i - 1] && plan[i] === plan[i - 2]) {
        bad = i;
        break;
      }
    }
    if (bad < 0) break;
    const swap = Math.floor(Math.random() * plan.length);
    [plan[bad], plan[swap]] = [plan[swap], plan[bad]];
  }
  return plan;
}

function distribute(count: number, buckets: number): number[] {
  const base = Math.floor(count / buckets);
  const result = Array.from({ length: buckets }, () => base);
  const extra = shuffle(Array.from({ length: buckets }, (_, i) => i)).slice(0, count - base * buckets);
  extra.forEach((i) => {
    result[i] += 1;
  });
  return result;
}

/**
 * Decides, BEFORE calling the AI, which topic / subtopic / question style / answer position
 * every question gets. This guarantees even topic coverage, no repeated subtopic clusters,
 * a realistic mix of question styles, and a balanced (non-patterned) answer key.
 */
export function planSlots(examModeId: ExamModeId, topicIds: string[], count: number): SlotPlan[] {
  const profile = EXAM_PROFILES[examModeId];
  if (!profile) throw new Error("This exam mode does not support MCQ practice.");

  const topics = EXAM_MODES[examModeId].syllabus.filter((topic) => topicIds.includes(topic.id));
  if (!topics.length) throw new Error("Select at least one valid topic.");

  const perTopic = distribute(count, topics.length);
  const answers = balancedAnswerPlan(count);
  const slots: SlotPlan[] = [];

  topics.forEach((topic, topicIndex) => {
    const styles = profile.stylesFor(topic);
    const subtopics = shuffle(topic.subtopics.length ? topic.subtopics : [topic.title]);
    const styleOffset = Math.floor(Math.random() * styles.length);

    for (let j = 0; j < perTopic[topicIndex]; j += 1) {
      const slot = slots.length;
      slots.push({
        slot,
        topicId: topic.id,
        topicTitle: topic.title,
        subtopic: subtopics[j % subtopics.length],
        style: styles[(styleOffset + j) % styles.length],
        targetIndex: answers[slot],
      });
    }
  });

  return slots;
}
