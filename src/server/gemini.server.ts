import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ============================================================================
// Question Generation Service
// ============================================================================

interface QuestionGenerationContext {
  previousAttempts?: number;
  averageScore?: number;
  weakAreas?: string[];
  difficulty?: "easy" | "medium" | "hard";
}

/**
 * Generate university-level exam question using Gemini
 * Uses user's progress context to personalize questions
 */
export async function generateQuestion(
  topic: string,
  marks: number,
  questionType: "theory" | "numerical" | "auto",
  context: QuestionGenerationContext = {},
  customPrompt?: string,
): Promise<{ question: string; type: "theory" | "numerical" }> {
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  // Build hidden context for personalization
  let contextPrompt = "";
  if (context.previousAttempts) {
    contextPrompt += `
[USER LEARNING PROFILE - FOR INTERNAL ANALYSIS ONLY]
Previous Attempts: ${context.previousAttempts}
Average Score: ${context.averageScore}%
Weak Areas: ${context.weakAreas?.join(", ") || "None"}
Difficulty Level: ${context.difficulty || "medium"}
`;
  }

  const typeInstruction =
    questionType === "auto"
      ? `Determine the most suitable question type (theory or numerical) for "${topic}". If numerical questions don't naturally fit this topic, generate a theory question. If theory questions don't naturally fit, generate a numerical question.`
      : `Generate a ${questionType} question`;

  const prompt = `You are an expert university examiner creating ${marks}-mark examination questions.

${contextPrompt}

Topic: ${topic}
Marks: ${marks}
${typeInstruction}

DIFFICULTY RULES - IMPORTANT:
These questions should be EASY TO MEDIUM difficulty, not hard. Follow these strict rules:

For Theory Questions:
- Test understanding and explanation, NOT deep analysis or research
- Focus on concepts that can be answered from regular class notes
- Avoid combining multiple major concepts into one question
- Avoid case-study, application-heavy, or research-heavy questions
- A student with standard class notes should be able to answer

For Numerical Questions:
- Require direct application of standard formulas, algorithms, or procedures
- Keep calculations short and manageable (can be done in exam time)
- Avoid lengthy computations, tricky edge cases, or multiple methods in one question
- Use straightforward, standard problems from textbooks

General Requirements:
- Clear, concise wording that's unambiguous
- Testable and well-defined scope
- Appropriate for a student who studied class notes
${context.weakAreas ? `- Emphasize these weak areas: ${context.weakAreas.join(", ")}` : ""}
- Never repeat questions from student's previous attempts
${customPrompt ? `\nSPECIAL INSTRUCTION FROM STUDENT:\n${customPrompt}` : ""}

IMPORTANT: Generate ONLY ONE question. No numbering, no explanation.
Return the pure question text only (can use basic markdown formatting like **bold** or *italic* for emphasis).`;

  const result = await model.generateContent(prompt);
  const questionText =
    result.response.text().trim() ||
    "Unable to generate question. Please try again.";

  // Detect question type if auto
  let detectedType: "theory" | "numerical" = "theory";
  if (questionType === "auto") {
    const numericKeywords = [
      "calculate",
      "compute",
      "solve",
      "derive",
      "show that",
      "prove",
      "coefficient",
      "equation",
      "value",
      "percentage",
      "rate",
    ];
    detectedType = numericKeywords.some((kw) =>
      questionText.toLowerCase().includes(kw),
    )
      ? "numerical"
      : "theory";
  } else {
    detectedType = questionType as "theory" | "numerical";
  }

  return {
    question: questionText,
    type: detectedType,
  };
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
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as {
    status?: number;
    statusCode?: number;
    message?: string;
  };

  return (
    maybeError.status === 429 ||
    maybeError.statusCode === 429 ||
    maybeError.message?.includes("429") === true ||
    maybeError.message?.toLowerCase().includes("quota") === true
  );
}

async function imageUrlToInlineData(imageUrl: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch answer image: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  return {
    inlineData: {
      mimeType: contentType,
      data: Buffer.from(await response.arrayBuffer()).toString("base64"),
    },
  };
}

/**
 * Evaluate student's handwritten answer using Gemini Vision
 * Returns detailed feedback following university examiner standards
 */
export async function evaluateAnswer(
  studentAnswerText: string,
  questionText: string,
  marks: number,
): Promise<{
  evaluation: EvaluationFeedback;
  modelAnswer: string;
}> {
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const wordLimit = marks === 8 ? 125 : 200;
  const modelAnswerPrompt = `Generate a concise, high-scoring model answer for this ${marks}-mark university exam question.

Question: ${questionText}

Requirements:
- ${marks === 8 ? "125 words" : "200 words"} maximum
- University-level standard
- Clear structure and key points
- Professional language
- Suitable for full marks

Return ONLY the model answer, no explanation or formatting.`;

  const evaluationPrompt = `You are an experienced university examiner evaluating student exam answers.

Question: ${questionText}
Marks: ${marks}
Expected Word Limit: ${wordLimit} words
Actual Student Answer: ${studentAnswerText}

STRICT EVALUATION CRITERIA:
1. Accuracy of concepts
2. Completeness of response
3. Relevance to the question
4. Structure and clarity
5. Technical precision

Provide:
1. Score out of ${marks} (e.g., 5.5/${marks})
2. Missing Concepts (bullet list)
3. Incorrect Statements (bullet list)
4. Areas to Improve (bullet list)
5. Exam Writing Suggestions (bullet list)

TONE: Professional, examiner-like. No motivation or generic praise.
Format output exactly as:
SCORE: X/${marks}
MISSING:
• point1
• point2
INCORRECT:
• point1
• point2
IMPROVE:
• point1
• point2
SUGGESTIONS:
• point1
• point2`;

  // Generate model answer
  const modelAnswerResult = await model.generateContent(modelAnswerPrompt);
  const modelAnswer = modelAnswerResult.response.text().trim();

  // Evaluate student answer
  const evaluationResult = await model.generateContent(evaluationPrompt);
  const evaluationText = evaluationResult.response.text().trim();

  // Parse evaluation response
  const feedback = parseEvaluationResponse(evaluationText, marks);

  return {
    evaluation: feedback,
    modelAnswer,
  };
}

/**
 * Read and evaluate a handwritten answer image in one Gemini Vision request.
 * This avoids spending separate requests on OCR, grading, and model answer.
 */
export async function evaluateAnswerFromImage(
  imageUrl: string,
  questionText: string,
  marks: number,
): Promise<{
  evaluation: EvaluationFeedback;
  modelAnswer: string;
  ocrText: string;
}> {
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
  const wordLimit = marks === 8 ? 125 : 200;

  const prompt = `You are an experienced university examiner evaluating a handwritten exam answer from an image.

Question: ${questionText}
Marks: ${marks}
Expected Word Limit: ${wordLimit} words

Tasks:
1. Read the handwritten answer from the image.
2. Evaluate the extracted answer against the question.
3. Generate a concise, high-scoring model answer for the same question.

STRICT EVALUATION CRITERIA:
1. Accuracy of concepts
2. Completeness of response
3. Relevance to the question
4. Structure and clarity
5. Technical precision

Return output exactly in this format:
OCR_TEXT:
extracted handwritten answer text here
SCORE: X/${marks}
MISSING:
- point1
- point2
INCORRECT:
- point1
- point2
IMPROVE:
- point1
- point2
SUGGESTIONS:
- point1
- point2
MODEL_ANSWER:
model answer here

Rules:
- If handwriting is unclear, use [unclear] in OCR_TEXT.
- Do not add motivation or generic praise.
- Keep MODEL_ANSWER within ${wordLimit} words.
- If a section has no issues, include "- None".`;

  const result = await model.generateContent([
    await imageUrlToInlineData(imageUrl),
    prompt,
  ]);
  const responseText = result.response.text().trim();

  return {
    evaluation: parseEvaluationResponse(responseText, marks),
    modelAnswer: extractSection(responseText, "MODEL_ANSWER").trim(),
    ocrText: extractSection(responseText, "OCR_TEXT", "SCORE:").trim(),
  };
}

/**
 * Parse Gemini's evaluation response into structured feedback
 */
function parseEvaluationResponse(
  responseText: string,
  marks: number,
): EvaluationFeedback {
  const sections = {
    score: 0,
    missingConcepts: [] as string[],
    incorrectStatements: [] as string[],
    areasToImprove: [] as string[],
    examWritingSuggestions: [] as string[],
  };

  // Extract score
  const scoreMatch = responseText.match(/SCORE:\s*([\d.]+)/i);
  if (scoreMatch) {
    sections.score = parseFloat(scoreMatch[1]);
  }

  // Extract sections
  const missingMatch = responseText.match(/MISSING:([\s\S]*?)(?:INCORRECT:|IMPROVE:|SUGGESTIONS:|$)/i);
  if (missingMatch) {
    sections.missingConcepts = extractBullets(missingMatch[1]);
  }

  const incorrectMatch = responseText.match(/INCORRECT:([\s\S]*?)(?:IMPROVE:|SUGGESTIONS:|$)/i);
  if (incorrectMatch) {
    sections.incorrectStatements = extractBullets(incorrectMatch[1]);
  }

  const improveMatch = responseText.match(/IMPROVE:([\s\S]*?)(?:SUGGESTIONS:|$)/i);
  if (improveMatch) {
    sections.areasToImprove = extractBullets(improveMatch[1]);
  }

  const suggestionsMatch = responseText.match(/SUGGESTIONS:([\s\S]*?)$/i);
  if (suggestionsMatch) {
    sections.examWritingSuggestions = extractBullets(suggestionsMatch[1]);
  }

  return {
    score: sections.score,
    missingConcepts: sections.missingConcepts,
    incorrectStatements: sections.incorrectStatements,
    areasToImprove: sections.areasToImprove,
    examWritingSuggestions: sections.examWritingSuggestions,
  };
}

/**
 * Extract bullet points from text
 */
function extractBullets(text: string): string[] {
  return text
    .split("\n")
    .filter((line) => line.trim().startsWith("•") || line.trim().startsWith("-"))
    .map((line) => line.replace(/^[\s•\-]+/, "").trim())
    .filter((line) => line.length > 0);
}

function extractSection(
  text: string,
  startLabel: string,
  endLabel?: string,
): string {
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

/**
 * Extract text from handwritten answer image using Gemini Vision
 * Supports JPG, PNG, JPEG
 */
export async function extractTextFromImage(imageUrl: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = `Extract all text from this handwritten exam answer image. 
Return ONLY the extracted text, preserving formatting and structure.
If text is unclear, use [unclear] to mark illegible parts.
Do not add any interpretation or correction.`;

  const result = await model.generateContent([
    await imageUrlToInlineData(imageUrl),
    prompt,
  ]);

  return result.response.text().trim();
}

// ============================================================================
// Syllabus Analysis Service
// ============================================================================

/**
 * Extract topics from uploaded syllabus
 * This would process PDF/TXT/DOCX files
 */
export async function extractTopicsFromSyllabus(
  syllabusText: string,
): Promise<string[]> {
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = `Analyze this syllabus and extract a comprehensive list of learning topics/units.
Return ONLY a JSON array of topics, no explanation.

Example output:
["Topic 1: Normalization", "Topic 2: ACID Properties", "Topic 3: Deadlock Management"]

Syllabus:
${syllabusText}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();

  try {
    // Extract JSON array from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("[Gemini] Failed to parse topics");
  }

  return [];
}

/**
 * Extract categorized topics from syllabus text
 * Organizes topics into main categories
 */
export async function extractCategorizedTopicsFromSyllabus(
  syllabusText: string,
): Promise<Array<{ name: string; subtopics: string[] }>> {
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  const prompt = `Analyze this syllabus and organize topics into main subject categories.
Return ONLY a JSON array of objects with "name" (category) and "subtopics" (array of topics) fields.
No explanation, just valid JSON.

Example output:
[
  {"name": "Database Management Systems", "subtopics": ["ER Modeling", "Relational Model", "SQL", "Transaction Management"]},
  {"name": "Data Structures", "subtopics": ["Arrays", "Linked Lists", "Trees", "Graphs"]}
]

Syllabus:
${syllabusText}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();

  try {
    // Extract JSON array from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error("[Gemini] Failed to parse categorized topics");
  }

  return [];
}
