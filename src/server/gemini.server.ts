import { GoogleGenAI } from "@google/genai";
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


interface QuestionGenerationContext {
  previousAttempts?: number;
  averageScore?: number;
  weakAreas?: string[];
  difficulty?: "easy" | "medium" | "hard";
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
): Promise<{ question: string; type: "theory" | "numerical" }> {
  const model = "gemma-4-31b-it";
  let messageIndex = 0;

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

  const prompt = `You are an experienced Indian university paper setter for LT-grade / IKTU / AKTU semester examinations (B.Tech / BCA / MCA / B.Sc CS level).

${contextBlock}TOPIC: ${topic}
MARKS: ${marks}
QUESTION TYPE: ${effectiveType}
${seedBlock}
${marksGuide}

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

Output ONLY the question text.
No numbering. No marks label. No explanation. No model answer.`;

  onProgress?.(getLoadingMessage(QUESTION_GENERATION_MESSAGES, messageIndex++));

  const contents = [
    {
      role: "user" as const,
      parts: [{ text: prompt }],
    },
  ];

  let questionText = "";
  const response = await ai.models.generateContentStream({ model, contents });

  let chunkCount = 0;
  for await (const chunk of response) {
    if (chunk.text) {
      questionText += chunk.text;
      if (chunkCount++ % 3 === 0) {
        onProgress?.(getLoadingMessage(QUESTION_GENERATION_MESSAGES, messageIndex++));
      }
    }
  }

  questionText = questionText.trim();

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

  return { question: questionText, type: detectedType };
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
  const model = "gemma-3-27b-it";
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
• [missing concept or step]
• [missing concept or step]
INCORRECT:
• [incorrect claim or wrong calculation step]
IMPROVE:
• [specific improvement suggestion]
SUGGESTIONS:
• [exam writing tip]

Rules:
- Use bullet points starting with •
- If a section has nothing to report, write: • None
- Score must be a number like 6.5 or 8 — not a range
- Be specific, not generic (e.g. "Did not explain deadlock detection" not "Answer is incomplete")`;

  onProgress?.(getLoadingMessage(ANSWER_EVALUATION_MESSAGES, messageIndex++));

  // Generate model answer
  let modelAnswer = "";
  const modelResp = await ai.models.generateContentStream({
    model,
    contents: [{ role: "user" as const, parts: [{ text: modelAnswerPrompt }] }],
  });
  let chunkCount = 0;
  for await (const chunk of modelResp) {
    if (chunk.text) {
      modelAnswer += chunk.text;
      if (chunkCount++ % 3 === 0)
        onProgress?.(getLoadingMessage(ANSWER_EVALUATION_MESSAGES, messageIndex++));
    }
  }
  modelAnswer = modelAnswer.trim();

  // Evaluate student answer
  onProgress?.(getLoadingMessage(ANSWER_EVALUATION_MESSAGES, messageIndex++));
  let evaluationText = "";
  const evalResp = await ai.models.generateContentStream({
    model,
    contents: [{ role: "user" as const, parts: [{ text: evaluationPrompt }] }],
  });
  chunkCount = 0;
  for await (const chunk of evalResp) {
    if (chunk.text) {
      evaluationText += chunk.text;
      if (chunkCount++ % 3 === 0)
        onProgress?.(getLoadingMessage(ANSWER_EVALUATION_MESSAGES, messageIndex++));
    }
  }
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
  imageUrl: string,
  questionText: string,
  marks: number,
  onProgress?: (message: string) => void,
): Promise<{ evaluation: EvaluationFeedback; modelAnswer: string; ocrText: string }> {
  const model = "gemma-4-31b-it";
  const wordLimit = marks <= 8 ? 130 : 220;
  let messageIndex = 0;

  const prompt = `You are an experienced Indian university examiner evaluating a handwritten exam answer from an image.

Question: ${questionText}
Total Marks: ${marks}
Expected Answer Length: ~${wordLimit} words

TASKS:
1. Read all handwritten text from the image (OCR)
2. Evaluate the answer against the question using university examiner standards
3. Generate a complete model answer for the same question

Respond in EXACTLY this format — no extra text outside these sections:

OCR_TEXT:
[write the extracted handwritten text here verbatim; mark unclear parts as [unclear]]
SCORE: X/${marks}
MISSING:
• [missing concept or step]
INCORRECT:
• [wrong statement or calculation error]
IMPROVE:
• [specific improvement suggestion]
SUGGESTIONS:
• [exam writing tip]
MODEL_ANSWER:
[complete model answer here — max ${wordLimit} words; for numerical questions show all working steps]

Rules:
- Each bullet section: if nothing to report, write • None
- Score must be a single number like 7 or 9.5
- Be specific in feedback (name the exact missing concept or wrong step)
- Model answer must be exam-ready and high-scoring`;

  onProgress?.(getLoadingMessage(IMAGE_OCR_MESSAGES, messageIndex++));

  const imageData = await imageUrlToInlineData(imageUrl);
  const contents = [
    {
      role: "user" as const,
      parts: [imageData, { text: prompt }],
    },
  ];

  let responseText = "";
  const response = await ai.models.generateContentStream({ model, contents });
  let chunkCount = 0;
  for await (const chunk of response) {
    if (chunk.text) {
      responseText += chunk.text;
      if (chunkCount++ % 2 === 0)
        onProgress?.(
          getLoadingMessage(
            [...IMAGE_OCR_MESSAGES, ...ANSWER_EVALUATION_MESSAGES],
            messageIndex++,
          ),
        );
    }
  }
  responseText = responseText.trim();

  onProgress?.(getLoadingMessage(IMAGE_OCR_MESSAGES, messageIndex + 1));

  return {
    evaluation: parseEvaluationResponse(responseText, marks),
    modelAnswer: extractSection(responseText, "MODEL_ANSWER").trim(),
    ocrText: extractSection(responseText, "OCR_TEXT", "SCORE:").trim(),
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
    .filter((line) => line.startsWith("•") || line.startsWith("-") || line.startsWith("*"))
    .map((line) => line.replace(/^[•\-\*]\s*/, "").trim())
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
  const model = "gemma-3-27b-it";

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
  const response = await ai.models.generateContentStream({ model, contents });
  for await (const chunk of response) {
    if (chunk.text) result += chunk.text;
  }

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