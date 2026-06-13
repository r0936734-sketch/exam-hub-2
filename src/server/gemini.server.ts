import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import {
  QUESTION_GENERATION_MESSAGES,
  ANSWER_EVALUATION_MESSAGES,
  IMAGE_OCR_MESSAGES,
  SYLLABUS_PARSING_MESSAGES,
  getLoadingMessage,
} from "../lib/loading-messages";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

type GenerateContentParams = Parameters<typeof ai.models.generateContentStream>[0];

const GEMINI_STREAM_START_TIMEOUT_MS = 120_000;
const GEMINI_STREAM_CHUNK_TIMEOUT_MS = 120_000;
const QUESTION_STREAM_START_TIMEOUT_MS = 180_000;
const QUESTION_STREAM_CHUNK_TIMEOUT_MS = 180_000;

const highThinkingSearchConfig = {
  thinkingConfig: {
    thinkingLevel: ThinkingLevel.HIGH,
  },
  tools: [
    {
      googleSearch: {},
    },
  ],
};

const minimalThinkingSearchConfig = {
  thinkingConfig: {
    thinkingLevel: ThinkingLevel.MINIMAL,
  },
  tools: [
    {
      googleSearch: {},
    },
  ],
};

const QUESTION_GENERATION_MODELS = [
  {
    name: "gemma-4-31b-it",
  },
  {
    name: "gemma-4-26b-a4b-it",
    config: highThinkingSearchConfig,
  },
];

const ANSWER_EVALUATION_MODELS = [
  {
    name: "gemma-3-27b-it",
  },
  {
    name: "gemma-4-26b-a4b-it",
    config: highThinkingSearchConfig,
  },
  
];

const IMAGE_EVALUATION_MODELS = [
  {
    name: "gemma-4-31b-it",
  },
  {
    name: "gemma-4-26b-a4b-it",
    config: highThinkingSearchConfig,
  },
  
];

function isGeminiFallbackError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; statusCode?: number; message?: string };
  const message = e.message?.toLowerCase() ?? "";

  return (
    e.status === 429 ||
    e.statusCode === 429 ||
    e.status === 503 ||
    e.statusCode === 503 ||
    message.includes("429") ||
    message.includes("503") ||
    message.includes("quota") ||
    message.includes("busy") ||
    message.includes("overloaded") ||
    message.includes("unavailable") ||
    message.includes("high demand") ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
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

async function streamGeminiTextWithFallback({
  models,
  contents,
  operationLabel,
  fallbackMessage,
  onText,
  onProgressChunk,
  onFallback,
  startTimeoutMs = GEMINI_STREAM_START_TIMEOUT_MS,
  chunkTimeoutMs = GEMINI_STREAM_CHUNK_TIMEOUT_MS,
}: {
  models: Array<{ name: string; config?: GenerateContentParams["config"] }>;
  contents: GenerateContentParams["contents"];
  operationLabel: string;
  fallbackMessage?: string;
  onText?: (text: string) => void;
  onProgressChunk?: () => void;
  onFallback?: (message: string) => void;
  startTimeoutMs?: number;
  chunkTimeoutMs?: number;
}): Promise<string> {
  let lastError: unknown;

  // Try models one at a time. A fallback is only called after the current model fails.
  for (let modelIndex = 0; modelIndex < models.length; modelIndex++) {
    const model = models[modelIndex];
    let iterator: AsyncGenerator<{ text?: string }> | undefined;

    try {
      let attemptText = "";
      const response = await withTimeout(
        ai.models.generateContentStream({
          model: model.name,
          config: model.config,
          contents,
        }),
        startTimeoutMs,
        `${operationLabel} timed out while starting ${model.name}`,
      );

      iterator = response as AsyncGenerator<{ text?: string }>;

      while (true) {
        const chunk = await withTimeout(
          iterator.next(),
          chunkTimeoutMs,
          `${operationLabel} timed out while streaming from ${model.name}`,
        );

        if (chunk.done) break;
        if (chunk.value.text) {
          attemptText += chunk.value.text;
          onText?.(chunk.value.text);
          onProgressChunk?.();
        }
      }

      return attemptText;
    } catch (error) {
      lastError = error;
      console.warn(`[Gemini] ${operationLabel} failed with ${model.name}`, error);

      try {
        await iterator?.return?.(undefined);
      } catch {
        // Best-effort stream cleanup after timeout/failure.
      }

      const hasFallbackModel = modelIndex < models.length - 1;
      if (!hasFallbackModel || !isGeminiFallbackError(error)) {
        throw error;
      }

      if (fallbackMessage) {
        onFallback?.(fallbackMessage);
        console.info(`[Gemini] ${fallbackMessage}`);
      }
    }
  }

  throw lastError;
}


interface QuestionGenerationContext {
  previousAttempts?: number;
  averageScore?: number;
  weakAreas?: string[];
  difficulty?: "easy" | "medium" | "hard";
  selectedCategory?: string;
  candidateSubtopics?: string[];
}

/**
 * Build a concrete numerical dataset for topics that need one.
 * This is injected into the prompt so Gemini uses real values — not "assume values".
 */
function getNumericalSeed(topic: string): string {
  const t = topic.toLowerCase();

  if (t.includes("dijkstra") || t.includes("shortest path")) {
    return `Use this weighted graph (adjacency list):
A–B: 6, A–C: 4, B–C: 2, B–D: 9, C–E: 5, D–F: 3, E–D: 1, E–F: 8`;
  }
  if (t.includes("quick sort") || t.includes("quicksort")) {
    return `Use this array: [45, 12, 78, 3, 56, 29, 64, 11]`;
  }
  if (t.includes("merge sort")) {
    return `Use this array: [38, 27, 43, 3, 9, 82, 10]`;
  }
  if (t.includes("banker") || t.includes("deadlock")) {
    return `Resources: A=9, B=3, C=6
Allocation — P0(2,1,2), P1(3,0,2), P2(2,1,1), P3(1,0,2), P4(1,1,0)
Max — P0(4,2,3), P1(9,0,2), P2(3,3,3), P3(2,2,2), P4(4,3,3)`;
  }
  if (t.includes("fcfs") || t.includes("sjf") || t.includes("round robin") || t.includes("scheduling")) {
    return `Process table:
| Process | Arrival Time | Burst Time |
|---------|-------------|------------|
| P1      | 0           | 6          |
| P2      | 1           | 8          |
| P3      | 2           | 7          |
| P4      | 3           | 3          |
Time Quantum for Round Robin = 2`;
  }
  if (t.includes("normali") || t.includes("1nf") || t.includes("2nf") || t.includes("3nf")) {
    return `Relation: OrderDetails(OrderID, CustomerName, CustomerCity, ProductID, ProductName, Category, Quantity, UnitPrice)`;
  }
  if (t.includes("packet") || t.includes("store-and-forward") || t.includes("switching")) {
    return `Message size: 800,000 bits | Packet size: 10,000 bits | Links: 3 | Transmission rate: 4 Mbps | Ignore propagation delay`;
  }
  if (t.includes("topology") || t.includes("bus") || t.includes("star")) {
    return `Network has 12 computers.
Bus topology: backbone cable = 60 m, drop line per computer = 3 m
Star topology: each computer connected via 10 m cable to central switch`;
  }
  if (t.includes("bresenham") || t.includes("line draw")) {
    return `Draw a line from starting point (1, 2) to ending point (8, 6). List all pixels plotted step-by-step.`;
  }
  if (t.includes("2d transform") || t.includes("rotation") || t.includes("translation") || t.includes("scaling")) {
    return `Triangle vertices: A(2,1), B(5,1), C(3,4). First scale by Sx=2, Sy=2, then rotate by 30° about origin. Find new coordinates.`;
  }
  if (t.includes("hexadecimal") || t.includes("binary") || t.includes("number system") || t.includes("conversion")) {
    return `Convert (3CA8)₁₆ to Binary and Decimal. Also find its 1's complement and 2's complement.`;
  }
  if (t.includes("k-map") || t.includes("boolean") || t.includes("karnaugh")) {
    return `Simplify F(A,B,C,D) = Σm(0,1,4,5,7,8,9,12,13) using K-map and draw the simplified Logic Diagram.`;
  }
  if (t.includes("rsa")) {
    return `Use p=7, q=11. Encrypt message M=5. Show key generation, encryption, and decryption steps.`;
  }
  if (t.includes("webpage") || t.includes("http") || t.includes("download time")) {
    return `Webpage: 1 HTML file (40 KB) + 5 images (100 KB each). Network throughput: 6 Mbps. Ignore TCP setup and latency.`;
  }
  if (t.includes("lru") || t.includes("fifo") || t.includes("page replacement") || t.includes("paging")) {
    return `Reference string: 1, 3, 0, 3, 5, 6, 3, 1, 6, 1, 2, 3 | Number of frames: 3. Apply both FIFO and LRU and count page faults.`;
  }
  if (t.includes("cache") || t.includes("hit ratio")) {
    return `Cache access time: 20 ns, Main memory time: 200 ns, Hit ratio: 0.85. Calculate effective memory access time.`;
  }

  return ""; // No seed — theory question
}

function normalizeTopicName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function findMatchingSubtopic(value: string, candidateSubtopics: string[]) {
  const normalizedValue = normalizeTopicName(value);
  return candidateSubtopics.find((subtopic) => normalizeTopicName(subtopic) === normalizedValue);
}

function parseGeneratedQuestionResponse(
  responseText: string,
  candidateSubtopics: string[],
): { question: string; selectedTopic?: string } {
  const selectedMatch = responseText.match(/SELECTED_SUBTOPIC:\s*(.+)/i);
  const questionMatch = responseText.match(/QUESTION:\s*([\s\S]*)/i);
  const selectedTopic = selectedMatch
    ? findMatchingSubtopic(selectedMatch[1].trim(), candidateSubtopics)
    : undefined;

  if (questionMatch?.[1]?.trim()) {
    return {
      question: questionMatch[1].trim(),
      selectedTopic,
    };
  }

  return {
    question: responseText
      .replace(/SELECTED_SUBTOPIC:\s*.+/gi, "")
      .replace(/QUESTION:\s*/gi, "")
      .trim(),
    selectedTopic,
  };
}

/**
 * Generate university-level exam question using Gemini
 */
export async function generateQuestion(
  topic: string,
  marks: number,
  questionType: "theory" | "numerical" | "auto",
  context: QuestionGenerationContext = {},
  customPrompt?: string,
  onProgress?: (message: string) => void,
): Promise<{
  question: string;
  type: "theory" | "numerical";
  selectedTopic: string;
  modelNotices: string[];
}> {
  let messageIndex = 0;
  const modelNotices: string[] = [];

  // Get numerical seed data for this topic
  const numericalSeed = getNumericalSeed(topic);
  const hasSeed = numericalSeed.trim().length > 0;

  // Determine effective question type
  const effectiveType =
    questionType === "auto"
      ? hasSeed
        ? "numerical"
        : "theory"
      : questionType;

  // User learning context
  let contextBlock = "";
  if (context.weakAreas?.length) {
    contextBlock = `[FOCUS AREAS: ${context.weakAreas.join(", ")}]\n`;
  }

  const candidateSubtopics = context.candidateSubtopics?.filter(Boolean) ?? [];
  const shouldChooseSubtopic = candidateSubtopics.length > 0;
  const topicLabel = shouldChooseSubtopic
    ? `${context.selectedCategory ?? topic} (AI should choose the best subtopic)`
    : topic;

  // Marks-based length and depth guide
  const marksGuide =
    marks <= 8
      ? `SHORT ANSWER (${marks} Marks):
- One focused concept or problem
- Expected written answer: 100–130 words
- For numerical: solve a single clear problem showing all steps
- For theory: explain with one example or diagram reference`
      : `LONG ANSWER (${marks} Marks):
- One major concept explained in full depth, OR a complete numerical solution
- Expected written answer: 180–230 words
- For numerical: full step-by-step derivation, algorithm trace, or table-based solution
- For theory: include comparison / diagram / algorithm / application / time complexity`;

  // Build the core prompt
  const seedBlock = hasSeed && effectiveType === "numerical"
    ? `\nUSE THIS DATA IN THE QUESTION (do not say "assume values" — embed these exact values):\n${numericalSeed}\n`
    : "";

  const typeInstruction =
    effectiveType === "numerical"
      ? `Generate a NUMERICAL / PROBLEM-SOLVING question. The question must contain all required data values inline — no assumptions needed.`
      : `Generate a THEORY question. It must ask the student to explain, compare, differentiate, describe, derive, or illustrate.`;

  const realExamExamples =
    effectiveType === "numerical"
      ? `Real exam question style examples (for reference only — do not copy):
- "A message of 1,200,000 bits is sent through a packet-switched network. Packets are 12,000 bits each. There are 4 links each at 3 Mbps. Find the total delivery time assuming store-and-forward switching."
- "Sort the array [38, 27, 43, 3, 9, 82, 10, 64] using Quick Sort. Show all steps and analyze Best Case, Worst Case, and Average Case Time Complexity."
- "Using Banker's Algorithm, find the safe sequence for: Resources A=10, B=5, C=7 | Allocation: P0(0,1,0), P1(2,0,0), P2(3,0,2), P3(2,1,1), P4(0,0,2) | Max: P0(7,5,3), P1(3,2,2), P2(9,0,2), P3(2,2,2), P4(4,3,3)"`
      : `Real exam question style examples (for reference only — do not copy):
- "Explain Inheritance and Polymorphism in Object-Oriented Programming with suitable examples."
- "Explain the Waterfall Model of SDLC with a diagram."
- "What is the difference between Symmetric Key and Asymmetric Key encryption? Explain with examples."
- "Briefly describe the names, functions and protocols of all seven layers of the OSI Reference Model."`;

  const subtopicSelectionBlock = shouldChooseSubtopic
    ? `\nSUBTOPIC SELECTION MODE:
The student selected the broad category "${context.selectedCategory ?? topic}" and did not choose a specific subtopic.
Choose the most exam-important subtopic from this exact list, while respecting QUESTION TYPE, MARKS, and any special instruction:
${candidateSubtopics.map((subtopic, index) => `${index + 1}. ${subtopic}`).join("\n")}

Selection rules:
- Pick one strongest subtopic for a university-style question
- Prefer a numerical/problem-solving subtopic when QUESTION TYPE is numerical
- Prefer an explanation/comparison/design subtopic when QUESTION TYPE is theory
- If QUESTION TYPE is auto, choose the subtopic that best fits a high-quality ${marks}-mark question
- If the student's special instruction points toward a specific item in the list, follow it
- SELECTED_SUBTOPIC must exactly match one item from the list\n`
    : "";

  const prompt = `You are an experienced Indian university paper setter for LT-grade / IKTU / AKTU semester examinations (B.Tech / BCA / MCA / B.Sc CS level).

${contextBlock}TOPIC: ${topicLabel}
MARKS: ${marks}
QUESTION TYPE: ${effectiveType}
${seedBlock}
${marksGuide}
${subtopicSelectionBlock}

${typeInstruction}

${realExamExamples}

STRICT QUESTION REQUIREMENTS:
1. Start with one of: Explain, Define, Compare, Differentiate, Describe, Derive, Analyze, Apply, Calculate, Convert, Simplify, Normalize, Draw, Solve, Discuss, State, Prove, Illustrate, Find
2. The question must be a complete, grammatically correct sentence
3. Must be entirely self-contained — all data, tables, values embedded inline
4. NEVER say "assume suitable values" or "consider a graph" without providing it
5. Match difficulty to ${marks} marks — not too simple, not research-level
6. If the topic is naturally theory (e.g. OSI layers, SDLC, OOP concepts), generate a theory question even if type is "numerical"
7. For numerical questions: include the complete problem data (arrays, tables, graph edges, resource matrices) inside the question itself

${customPrompt ? `SPECIAL INSTRUCTION FROM STUDENT:\n${customPrompt}\n` : ""}

VALIDATION BEFORE OUTPUT:
✓ Question starts with a standard action verb
✓ All necessary data is embedded (no missing values)
✓ Suitable for ${marks}-mark answer
✓ Matches IKTU/AKTU university style
✓ No fragments, no truncation

${shouldChooseSubtopic
  ? `Output EXACTLY in this format:
SELECTED_SUBTOPIC: [exact subtopic from the list]
QUESTION: [question text]

No numbering. No marks label. No explanation. No model answer.`
  : `Output ONLY the question text.
No numbering. No marks label. No explanation. No model answer.`}`;

  onProgress?.(getLoadingMessage(QUESTION_GENERATION_MESSAGES, messageIndex++));

  const contents = [
    {
      role: "user" as const,
      parts: [{ text: prompt }],
    },
  ];

  let questionText = "";
  let chunkCount = 0;
  questionText = await streamGeminiTextWithFallback({
    models: QUESTION_GENERATION_MODELS,
    contents,
    operationLabel: "Question generation",
    fallbackMessage: "Gemma 31B is busy or quota-limited. Switching to Gemma 26B...",
    startTimeoutMs: QUESTION_STREAM_START_TIMEOUT_MS,
    chunkTimeoutMs: QUESTION_STREAM_CHUNK_TIMEOUT_MS,
    onProgressChunk: () => {
      if (chunkCount++ % 3 === 0) {
        onProgress?.(getLoadingMessage(QUESTION_GENERATION_MESSAGES, messageIndex++));
      }
    },
    onFallback: (message) => {
      modelNotices.push(message);
      onProgress?.(message);
    },
  });

  const parsedQuestion = shouldChooseSubtopic
    ? parseGeneratedQuestionResponse(questionText.trim(), candidateSubtopics)
    : { question: questionText.trim(), selectedTopic: undefined };
  questionText = parsedQuestion.question;
  const selectedTopic = parsedQuestion.selectedTopic ?? (shouldChooseSubtopic ? candidateSubtopics[0] : topic);

  // Post-generation cleanup
  // Strip any leading numbering like "1." or "Q1." accidentally added
  questionText = questionText.replace(/^[\d]+[\.\)]\s*/, "").trim();
  // Strip markdown bold wrapping if model added it
  questionText = questionText.replace(/^\*\*(.*)\*\*$/, "$1").trim();

  if (!questionText || questionText.length < 20) {
    questionText = "Unable to generate question. Please try again.";
  }

  // Detect final type for tagging
  const detectedType: "theory" | "numerical" =
    questionType === "auto" ? effectiveType : (questionType as "theory" | "numerical");

  onProgress?.(getLoadingMessage(QUESTION_GENERATION_MESSAGES, messageIndex + 1));

  return { question: questionText, type: detectedType, selectedTopic, modelNotices };
}

// ============================================================================
// Answer Evaluation Service
// ============================================================================

interface EvaluationFeedback {
  score: number;
  missingConcepts: string[];
  incorrectStatements: string[];
  areasToImprove: string[];
  examWritingSuggestions: string[];
}

export function isGeminiQuotaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; statusCode?: number; message?: string };
  return (
    e.status === 429 ||
    e.statusCode === 429 ||
    e.message?.includes("429") === true ||
    e.message?.toLowerCase().includes("quota") === true
  );
}

export function isGeminiUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { status?: number; statusCode?: number; message?: string };
  const message = e.message?.toLowerCase() ?? "";

  return (
    e.status === 503 ||
    e.statusCode === 503 ||
    message.includes("503") ||
    message.includes("unavailable") ||
    message.includes("high demand")
  );
}

async function imageUrlToInlineData(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to fetch answer image: ${response.status}`);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  return {
    inlineData: {
      mimeType: contentType,
      data: Buffer.from(await response.arrayBuffer()).toString("base64"),
    },
  };
}

/**
 * Evaluate student's text answer using Gemini
 */
export async function evaluateAnswer(
  studentAnswerText: string,
  questionText: string,
  marks: number,
  onProgress?: (message: string) => void,
): Promise<{ evaluation: EvaluationFeedback; modelAnswer: string }> {
  let messageIndex = 0;

  const wordLimit = marks <= 8 ? 130 : 220;

  const modelAnswerPrompt = `You are an expert university examiner. Generate a complete, high-scoring model answer for the following ${marks}-mark exam question.

Question: ${questionText}

Requirements:
- Maximum ${wordLimit} words
- University standard — structured, precise, exam-ready
- For numerical questions: show all working steps, tables, and final answer clearly
- For theory questions: use clear headings, examples, and diagram descriptions where needed
- Write as if a top-scoring student wrote this answer
- Format the answer in clean Markdown using short headings, bullet points, numbered steps, and Markdown tables when a table improves clarity
- Use readable plain-text math with Unicode symbols where useful (×, ÷, ≈, ≥, ≤, µs). Do not use LaTeX commands such as \\frac, \\text, \\mu, \\times, or math dollar delimiters

Return ONLY the model answer. No preamble.`;

  const evaluationPrompt = `You are a strict but fair Indian university examiner grading a student's exam answer.

Question: ${questionText}
Total Marks: ${marks}
Expected Answer Length: ~${wordLimit} words

Student's Answer:
"""
${studentAnswerText}
"""

Evaluate using these criteria:
1. Conceptual accuracy
2. Completeness (are all parts of the question addressed?)
3. Correctness of numerical steps / derivations (if applicable)
4. Clarity and structure
5. Technical terminology usage

Respond in EXACTLY this format — no extra text:

SCORE: X/${marks}
MISSING:
- [missing concept or step]
- [missing concept or step]
INCORRECT:
- [incorrect claim or wrong calculation step]
IMPROVE:
- [specific improvement suggestion]
SUGGESTIONS:
- [exam writing tip]

Rules:
- Use bullet points starting with -
- If a section has nothing to report, write: - None
- Score must be a number like 6.5 or 8 — not a range
- Be specific, not generic (e.g. "Did not explain deadlock detection" not "Answer is incomplete")`;

  onProgress?.(getLoadingMessage(ANSWER_EVALUATION_MESSAGES, messageIndex++));

  // Generate model answer
  let modelAnswer = "";
  let chunkCount = 0;
  modelAnswer = await streamGeminiTextWithFallback({
    models: ANSWER_EVALUATION_MODELS,
    contents: [{ role: "user" as const, parts: [{ text: modelAnswerPrompt }] }],
    operationLabel: "Model answer generation",
    fallbackMessage: "The answer model is busy. Switching to a fallback model...",
    onProgressChunk: () => {
      if (chunkCount++ % 3 === 0)
        onProgress?.(getLoadingMessage(ANSWER_EVALUATION_MESSAGES, messageIndex++));
    },
    onFallback: (message) => onProgress?.(message),
  });
  modelAnswer = modelAnswer.trim();

  // Evaluate student answer
  onProgress?.(getLoadingMessage(ANSWER_EVALUATION_MESSAGES, messageIndex++));
  let evaluationText = "";
  chunkCount = 0;
  evaluationText = await streamGeminiTextWithFallback({
    models: ANSWER_EVALUATION_MODELS,
    contents: [{ role: "user" as const, parts: [{ text: evaluationPrompt }] }],
    operationLabel: "Answer evaluation",
    fallbackMessage: "The evaluation model is busy. Switching to a fallback model...",
    onProgressChunk: () => {
      if (chunkCount++ % 3 === 0)
        onProgress?.(getLoadingMessage(ANSWER_EVALUATION_MESSAGES, messageIndex++));
    },
    onFallback: (message) => onProgress?.(message),
  });
  evaluationText = evaluationText.trim();

  onProgress?.(getLoadingMessage(ANSWER_EVALUATION_MESSAGES, messageIndex + 1));

  return {
    evaluation: parseEvaluationResponse(evaluationText, marks),
    modelAnswer,
  };
}

/**
 * Read and evaluate a handwritten answer image in one Gemini Vision request.
 */
export async function evaluateAnswerFromImage(
  imageUrls: string[],
  questionText: string,
  marks: number,
  onProgress?: (message: string) => void,
): Promise<{
  evaluation: EvaluationFeedback;
  modelAnswer: string;
  ocrText: string;
  modelNotices: string[];
}> {
  const wordLimit = marks <= 8 ? 130 : 220;
  let messageIndex = 0;
  const modelNotices: string[] = [];
  const pageCount = imageUrls.length;

  const multiPageInstruction =
    pageCount > 1
      ? `\nThis answer spans ${pageCount} images, provided in order as Page 1, Page 2, etc. Treat them as one continuous handwritten answer — read all pages before evaluating, and merge the OCR text from all pages into a single OCR_TEXT section in the correct page order.\n`
      : "";

  const prompt = `You are an experienced Indian university examiner evaluating a handwritten exam answer from ${pageCount > 1 ? `${pageCount} images (multiple pages)` : "an image"}.

Question: ${questionText}
Total Marks: ${marks}
Expected Answer Length: ~${wordLimit} words
${multiPageInstruction}
TASKS:
1. Read all handwritten text from the image${pageCount > 1 ? "s" : ""} (OCR)
2. Evaluate the answer against the question using university examiner standards
3. Generate a complete model answer for the same question

Respond in EXACTLY this format — no extra text outside these sections:

OCR_TEXT:
[write the extracted handwritten text here verbatim${pageCount > 1 ? ", combining all pages in order" : ""}; mark unclear parts as [unclear]]
SCORE: X/${marks}
MISSING:
- [missing concept or step]
INCORRECT:
- [wrong statement or calculation error]
IMPROVE:
- [specific improvement suggestion]
SUGGESTIONS:
- [exam writing tip]
MODEL_ANSWER:
[complete model answer here — max ${wordLimit} words; for numerical questions show all working steps]

Rules:
- Each bullet section: if nothing to report, write - None
- Score must be a single number like 7 or 9.5
- Be specific in feedback (name the exact missing concept or wrong step)
- Model answer must be exam-ready and high-scoring
- Format MODEL_ANSWER in clean Markdown using short headings, bullet points, numbered steps, and Markdown tables when useful
- Use readable plain-text math with Unicode symbols where useful (×, ÷, ≈, ≥, ≤, µs). Do not use LaTeX commands such as \\frac, \\text, \\mu, \\times, or math dollar delimiters`;

  onProgress?.(getLoadingMessage(IMAGE_OCR_MESSAGES, messageIndex++));

  const imageParts = await Promise.all(
    imageUrls.map(async (url, index) => {
      const inlineData = await imageUrlToInlineData(url);
      return pageCount > 1
        ? [{ text: `Page ${index + 1}:` }, inlineData]
        : [inlineData];
    }),
  );
  const flattenedImageParts = imageParts.flat();

  const contents = [
    {
      role: "user" as const,
      parts: [...flattenedImageParts, { text: prompt }],
    },
  ];

  let responseText = "";
  let chunkCount = 0;
  responseText = await streamGeminiTextWithFallback({
    models: IMAGE_EVALUATION_MODELS,
    contents,
    operationLabel: "Image answer evaluation",
    fallbackMessage: "The image evaluation model is busy. Switching to a fallback model...",
    onProgressChunk: () => {
      if (chunkCount++ % 2 === 0)
        onProgress?.(
          getLoadingMessage(
            [...IMAGE_OCR_MESSAGES, ...ANSWER_EVALUATION_MESSAGES],
            messageIndex++,
          ),
        );
    },
    onFallback: (message) => {
      modelNotices.push(message);
      onProgress?.(message);
    },
  });
  responseText = responseText.trim();

  onProgress?.(getLoadingMessage(IMAGE_OCR_MESSAGES, messageIndex + 1));

  return {
    evaluation: parseEvaluationResponse(responseText, marks),
    modelAnswer: extractSection(responseText, "MODEL_ANSWER").trim(),
    ocrText: extractSection(responseText, "OCR_TEXT", "SCORE:").trim(),
    modelNotices,
  };
}

/**
 * Parse Gemini's evaluation response into structured feedback
 */
function parseEvaluationResponse(responseText: string, marks: number): EvaluationFeedback {
  const scoreMatch = responseText.match(/SCORE:\s*([\d.]+)/i);
  const score = scoreMatch ? Math.min(parseFloat(scoreMatch[1]), marks) : 0;

  const missingMatch = responseText.match(/MISSING:([\s\S]*?)(?:INCORRECT:|IMPROVE:|SUGGESTIONS:|MODEL_ANSWER:|$)/i);
  const incorrectMatch = responseText.match(/INCORRECT:([\s\S]*?)(?:IMPROVE:|SUGGESTIONS:|MODEL_ANSWER:|$)/i);
  const improveMatch = responseText.match(/IMPROVE:([\s\S]*?)(?:SUGGESTIONS:|MODEL_ANSWER:|$)/i);
  const suggestionsMatch = responseText.match(/SUGGESTIONS:([\s\S]*?)(?:MODEL_ANSWER:|$)/i);

  return {
    score,
    missingConcepts: missingMatch ? extractBullets(missingMatch[1]) : [],
    incorrectStatements: incorrectMatch ? extractBullets(incorrectMatch[1]) : [],
    areasToImprove: improveMatch ? extractBullets(improveMatch[1]) : [],
    examWritingSuggestions: suggestionsMatch ? extractBullets(suggestionsMatch[1]) : [],
  };
}

function extractBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(?:â€¢|•|-|\*)\s*/.test(line))
    .map((line) => line.replace(/^(?:â€¢|•|-|\*)\s*/, "").trim())
    .filter((line) => line.length > 0 && line.toLowerCase() !== "none");
}

function extractSection(text: string, startLabel: string, endLabel?: string): string {
  const escapedStart = startLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = endLabel?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escapedEnd
    ? new RegExp(`${escapedStart}:?([\\s\\S]*?)${escapedEnd}`, "i")
    : new RegExp(`${escapedStart}:?([\\s\\S]*)`, "i");
  const match = text.match(pattern);
  return match?.[1]?.trim() || "";
}

// ============================================================================
// Vision API for OCR (Handwritten Answer)
// ============================================================================

export async function extractTextFromImage(
  imageUrl: string,
  onProgress?: (message: string) => void,
): Promise<string> {
  const prompt = `Extract all handwritten text from this exam answer image exactly as written.
Preserve the structure, line breaks, and formatting.
For any unclear or illegible word, write [unclear] in its place.
Return ONLY the extracted text. No commentary.`;

  onProgress?.(getLoadingMessage(IMAGE_OCR_MESSAGES, 0));

  const imageData = await imageUrlToInlineData(imageUrl);
  const contents = [
    {
      role: "user" as const,
      parts: [imageData, { text: prompt }],
    },
  ];

  let result = "";
  result = await streamGeminiTextWithFallback({
    models: IMAGE_EVALUATION_MODELS,
    contents,
    operationLabel: "Image OCR",
    fallbackMessage: "The OCR model is busy. Switching to a fallback model...",
    onFallback: (message) => onProgress?.(message),
  });

  onProgress?.(getLoadingMessage(IMAGE_OCR_MESSAGES, 2));
  return result.trim();
}

// ============================================================================
// Syllabus Analysis Service
// ============================================================================

export async function extractTopicsFromSyllabus(
  syllabusText: string,
  onProgress?: (message: string) => void,
): Promise<string[]> {
  const model = "gemma-4-31b-it";

  const prompt = `Analyze this university syllabus and extract a comprehensive list of individual learning topics.
Return ONLY a JSON array of topic strings. No markdown, no explanation, no code fences.

Example output format:
["Topic 1: Normalization in DBMS", "Topic 2: ACID Properties", "Topic 3: Deadlock Management"]

Syllabus:
${syllabusText}`;

  onProgress?.(getLoadingMessage(SYLLABUS_PARSING_MESSAGES, 0));

  const contents = [{ role: "user" as const, parts: [{ text: prompt }] }];
  let responseText = "";
  const response = await ai.models.generateContentStream({ model, contents });

  let messageIndex = 0;
  for await (const chunk of response) {
    if (chunk.text) {
      responseText += chunk.text;
      if (messageIndex++ % 2 === 0)
        onProgress?.(getLoadingMessage(SYLLABUS_PARSING_MESSAGES, messageIndex));
    }
  }
  responseText = responseText.trim();

  onProgress?.(getLoadingMessage(SYLLABUS_PARSING_MESSAGES, 4));

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {
    console.error("[Gemini] Failed to parse topics");
  }
  return [];
}

export async function extractCategorizedTopicsFromSyllabus(
  syllabusText: string,
  onProgress?: (message: string) => void,
): Promise<Array<{ name: string; subtopics: string[] }>> {
  const model = "gemma-4-31b-it";

  const prompt = `Analyze this university syllabus and organize all topics into main subject categories.
Return ONLY a valid JSON array. No markdown, no explanation, no code fences.

Each object must have:
- "name": the subject/unit category name (e.g., "Database Management Systems")
- "subtopics": array of individual topic strings within that category

Example output format:
[
  {"name": "Database Management Systems", "subtopics": ["ER Modeling", "Normalization", "SQL Queries", "Transaction Management", "Deadlock"]},
  {"name": "Data Structures", "subtopics": ["Arrays and Strings", "Linked Lists", "Stack and Queue", "Trees", "Graphs", "Sorting Algorithms"]}
]

Syllabus:
${syllabusText}`;

  onProgress?.(getLoadingMessage(SYLLABUS_PARSING_MESSAGES, 0));

  const contents = [{ role: "user" as const, parts: [{ text: prompt }] }];
  let responseText = "";
  const response = await ai.models.generateContentStream({ model, contents });

  let messageIndex = 0;
  for await (const chunk of response) {
    if (chunk.text) {
      responseText += chunk.text;
      if (messageIndex++ % 2 === 0)
        onProgress?.(getLoadingMessage(SYLLABUS_PARSING_MESSAGES, messageIndex));
    }
  }
  responseText = responseText.trim();

  onProgress?.(getLoadingMessage(SYLLABUS_PARSING_MESSAGES, 4));

  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {
    console.error("[Gemini] Failed to parse categorized topics");
  }
  return [];
}