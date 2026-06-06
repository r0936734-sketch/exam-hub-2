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

Requirements:
- University-level rigor and standard
- Clear, concise wording
- Testable and well-defined
- Focus on application and understanding (not just definitions)
${context.weakAreas ? `- Emphasize these weak areas: ${context.weakAreas.join(", ")}` : ""}
- Never repeat questions from student's previous attempts

IMPORTANT: Generate ONLY ONE question. No numbering, no explanation.
Return the pure question text only.`;

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
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: Buffer.from(await fetch(imageUrl).then((r) => r.arrayBuffer())).toString(
          "base64",
        ),
      },
    },
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
