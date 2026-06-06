import { json, text } from "@tanstack/react-start";
import {
  isAIHubEnabled,
  verifyAIHubPasscode,
  getUserProgress,
  updateTopicProgress,
  getWeakTopics,
  storeGeneratedQuestion,
  hasQuestionBeenGenerated,
  generateQuestionHash,
  storeSyllabus,
  getSyllabus,
  storeEvaluation,
  getEvaluationHistory,
} from "./aihub";
import {
  generateQuestion,
  evaluateAnswer,
  extractTextFromImage,
  extractTopicsFromSyllabus,
} from "./gemini.server";
import { getUserFromServerContext } from "@/server/auth.server";

// ============================================================================
// AI HUB ACCESS CONTROL ENDPOINTS
// ============================================================================

/**
 * GET /api/aihub/access-status
 * Check if user has AI Hub access
 * Returns: { enabled: boolean, requiresPasscode: boolean }
 */
export async function getAIHubAccessStatus($serverContext: any) {
  const user = await getUserFromServerContext($serverContext);
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await isAIHubEnabled(user.id);
  return json({
    enabled,
    requiresPasscode: enabled,
  });
}

/**
 * POST /api/aihub/verify-passcode
 * Verify AI Hub secondary passcode
 * Body: { passcode: string }
 * Returns: { verified: boolean, token?: string }
 */
export async function verifyAIHubPasscodeEndpoint(
  $serverContext: any,
  request: Request,
) {
  const user = await getUserFromServerContext($serverContext);
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await isAIHubEnabled(user.id);
  if (!enabled) {
    return json({ error: "Access disabled" }, { status: 403 });
  }

  const body = await request.json();
  const { passcode } = body as { passcode: string };

  if (!passcode) {
    return json({ error: "Passcode required" }, { status: 400 });
  }

  const verified = await verifyAIHubPasscode(user.id, passcode);

  if (!verified) {
    return json({ error: "Invalid passcode" }, { status: 403 });
  }

  // Generate access token (valid for 1 hour)
  const token = Buffer.from(
    JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
      expiry: Date.now() + 3600000,
    }),
  ).toString("base64");

  return json({ verified: true, token });
}

// ============================================================================
// QUESTION GENERATION ENDPOINTS
// ============================================================================

/**
 * POST /api/aihub/generate-question
 * Generate a new university-style question
 * Body: { topic: string, marks: 8|12, questionType: "theory"|"numerical"|"auto", subject: string }
 */
export async function generateQuestionEndpoint(
  $serverContext: any,
  request: Request,
) {
  const user = await getUserFromServerContext($serverContext);
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { topic, marks, questionType, subject } = body as {
    topic: string;
    marks: number;
    questionType: "theory" | "numerical" | "auto";
    subject: string;
  };

  // Validation
  if (!topic || ![8, 12].includes(marks) || !questionType || !subject) {
    return json({ error: "Invalid request parameters" }, { status: 400 });
  }

  // Get user's progress to personalize
  const progress = await getUserProgress(user.id, subject);
  const topicProgress = progress.topicProgress?.get(topic);

  const context = topicProgress
    ? {
        previousAttempts: topicProgress.attempts,
        averageScore: topicProgress.averageScore,
        weakAreas: topicProgress.weakAreas,
        difficulty: topicProgress.difficulty,
      }
    : {};

  try {
    // Check syllabus topics
    const syllabuTopics = await getSyllabus(user.id, subject);
    if (syllabuTopics.length > 0 && !syllabuTopics.includes(topic)) {
      return json(
        { error: "Topic not found in uploaded syllabus" },
        { status: 400 },
      );
    }

    // Generate question
    const { question, type } = await generateQuestion(
      topic,
      marks,
      questionType,
      context,
    );

    // Check for duplicates
    const questionHash = generateQuestionHash(question);
    const isDuplicate = await hasQuestionBeenGenerated(user.id, questionHash);

    if (isDuplicate) {
      // Retry generation
      const { question: retryQuestion, type: retryType } =
        await generateQuestion(topic, marks, questionType, context);
      const retryHash = generateQuestionHash(retryQuestion);

      // Store generated question
      await storeGeneratedQuestion(
        user.id,
        topic,
        subject,
        retryQuestion,
        marks,
        retryType,
      );

      return json({
        question: retryQuestion,
        type: retryType,
        marks,
        wordLimit: marks === 8 ? 125 : 200,
      });
    }

    // Store generated question
    await storeGeneratedQuestion(user.id, topic, subject, question, marks, type);

    return json({
      question,
      type,
      marks,
      wordLimit: marks === 8 ? 125 : 200,
    });
  } catch (error) {
    console.error("[AI Hub] Question generation failed");
    return json(
      { error: "Failed to generate question" },
      { status: 500 },
    );
  }
}

// ============================================================================
// ANSWER EVALUATION ENDPOINTS
// ============================================================================

/**
 * POST /api/aihub/evaluate-answer
 * Evaluate student's handwritten answer
 * Body: { imageUrl: string, questionText: string, marks: number, topic: string, subject: string }
 */
export async function evaluateAnswerEndpoint(
  $serverContext: any,
  request: Request,
) {
  const user = await getUserFromServerContext($serverContext);
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { imageUrl, questionText, marks, topic, subject } = body as {
    imageUrl: string;
    questionText: string;
    marks: number;
    topic: string;
    subject: string;
  };

  if (!imageUrl || !questionText || ![8, 12].includes(marks)) {
    return json({ error: "Invalid request parameters" }, { status: 400 });
  }

  try {
    // Extract text from image using OCR
    const ocrText = await extractTextFromImage(imageUrl);

    // Evaluate answer
    const { evaluation, modelAnswer } = await evaluateAnswer(
      ocrText,
      questionText,
      marks,
    );

    // Update user's progress
    await updateTopicProgress(
      user.id,
      subject,
      topic,
      evaluation.score,
      marks,
    );

    // Store evaluation history (only essential data for optimization)
    await storeEvaluation(
      user.id,
      topic,
      subject,
      evaluation.score,
      marks,
    );

    return json({
      score: evaluation.score,
      maxMarks: marks,
      feedback: {
        missingConcepts: evaluation.missingConcepts,
        incorrectStatements: evaluation.incorrectStatements,
        areasToImprove: evaluation.areasToImprove,
        examWritingSuggestions: evaluation.examWritingSuggestions,
      },
      modelAnswer,
      ocrText,
    });
  } catch (error) {
    console.error("[AI Hub] Answer evaluation failed");
    return json(
      { error: "Failed to evaluate answer" },
      { status: 500 },
    );
  }
}

// ============================================================================
// PROGRESS & HISTORY ENDPOINTS
// ============================================================================

/**
 * GET /api/aihub/progress/:subject
 * Get user's progress for a subject
 */
export async function getUserProgressEndpoint(
  $serverContext: any,
  subject: string,
) {
  const user = await getUserFromServerContext($serverContext);
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const progress = await getUserProgress(user.id, subject);
    return json(progress);
  } catch (error) {
    console.error("[AI Hub] Progress fetch failed");
    return json({ error: "Failed to fetch progress" }, { status: 500 });
  }
}

/**
 * GET /api/aihub/weak-topics/:subject
 * Get topics where user needs improvement
 */
export async function getWeakTopicsEndpoint(
  $serverContext: any,
  subject: string,
) {
  const user = await getUserFromServerContext($serverContext);
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const weakTopics = await getWeakTopics(user.id, subject);
    return json({ topics: weakTopics });
  } catch (error) {
    console.error("[AI Hub] Weak topics fetch failed");
    return json({ error: "Failed to fetch weak topics" }, { status: 500 });
  }
}

/**
 * GET /api/aihub/evaluation-history
 * Get user's evaluation history
 */
export async function getEvaluationHistoryEndpoint($serverContext: any) {
  const user = await getUserFromServerContext($serverContext);
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const history = await getEvaluationHistory(user.id);
    return json({ history });
  } catch (error) {
    console.error("[AI Hub] History fetch failed");
    return json({ error: "Failed to fetch history" }, { status: 500 });
  }
}

// ============================================================================
// SYLLABUS MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * POST /api/aihub/upload-syllabus
 * Extract topics from uploaded syllabus
 * Body: { syllabusText: string, subject: string, fileUrl: string }
 */
export async function uploadSyllabusEndpoint(
  $serverContext: any,
  request: Request,
) {
  const user = await getUserFromServerContext($serverContext);
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { syllabusText, subject, fileUrl } = body as {
    syllabusText: string;
    subject: string;
    fileUrl: string;
  };

  if (!syllabusText || !subject) {
    return json({ error: "Invalid request parameters" }, { status: 400 });
  }

  try {
    // Extract topics using Gemini
    const topics = await extractTopicsFromSyllabus(syllabusText);

    // Store in database
    await storeSyllabus(user.id, subject, fileUrl || "", topics);

    return json({
      topics,
      message: "Syllabus processed successfully",
    });
  } catch (error) {
    console.error("[AI Hub] Syllabus upload failed");
    return json({ error: "Failed to process syllabus" }, { status: 500 });
  }
}

/**
 * GET /api/aihub/syllabus/:subject
 * Get uploaded syllabus topics
 */
export async function getSyllabusEndpoint(
  $serverContext: any,
  subject: string,
) {
  const user = await getUserFromServerContext($serverContext);
  if (!user) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const topics = await getSyllabus(user.id, subject);
    return json({ topics });
  } catch (error) {
    console.error("Syllabus fetch error:", error);
    return json({ error: "Failed to fetch syllabus" }, { status: 500 });
  }
}
