"use server";

import { createServerFn } from "@tanstack/react-start";
import {
  isAIHubEnabled,
  verifyAIHubPasscodeWithRateLimit,
  getUserProgress,
  updateTopicProgress,
  getWeakTopics,
  storeGeneratedQuestion,
  hasQuestionBeenGenerated,
  generateQuestionHash,
  storeEvaluation,
  getEvaluationHistory,
  getPendingQuestion,
  deletePendingQuestion,
} from "@/server/aihub";
import { COMPUTER_SCIENCE_SYLLABUS } from "@/server/seed-computer-syllabus";
import {
  generateQuestion,
  evaluateAnswerFromImage,
  isGeminiQuotaError,
  isGeminiUnavailableError,
} from "@/server/gemini.server";
import { getCurrentSessionServerFn } from "@/services/auth.functions";

type EvaluationProgressStatus = "processing" | "switching" | "completed" | "error";

interface EvaluationProgress {
  requestId: string;
  status: EvaluationProgressStatus;
  message: string;
  notices: string[];
  startedAt: number;
  updatedAt: number;
}

const evaluationProgressByRequestId = new Map<string, EvaluationProgress>();
const EVALUATION_PROGRESS_TTL_MS = 15 * 60 * 1000;

function isValidRequestId(requestId?: string) {
  return Boolean(requestId && /^[a-zA-Z0-9_-]{8,100}$/.test(requestId));
}

function cleanupEvaluationProgress() {
  const cutoff = Date.now() - EVALUATION_PROGRESS_TTL_MS;
  for (const [requestId, progress] of evaluationProgressByRequestId) {
    if (progress.updatedAt < cutoff) {
      evaluationProgressByRequestId.delete(requestId);
    }
  }
}

function updateEvaluationProgress(
  requestId: string | undefined,
  patch: Partial<Omit<EvaluationProgress, "requestId" | "startedAt" | "updatedAt">>,
) {
  if (!isValidRequestId(requestId)) return;

  cleanupEvaluationProgress();
  const now = Date.now();
  const current =
    evaluationProgressByRequestId.get(requestId) ??
    ({
      requestId,
      status: "processing",
      message: "Starting answer evaluation...",
      notices: [],
      startedAt: now,
      updatedAt: now,
    } as EvaluationProgress);

  evaluationProgressByRequestId.set(requestId, {
    ...current,
    ...patch,
    notices: patch.notices ?? current.notices,
    updatedAt: now,
  });
}

/**
 * Get live progress for a running handwritten answer evaluation.
 */
export const getEvaluationProgressFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: { requestId: string }) => data)
  .handler(async ({ data }) => {
    if (!isValidRequestId(data.requestId)) {
      return { progress: null };
    }

    cleanupEvaluationProgress();
    return {
      progress: evaluationProgressByRequestId.get(data.requestId) ?? null,
    };
  });

function getBuiltInSyllabusCategories(subject: string) {
  if (subject.toLowerCase() !== "computer science") {
    return [];
  }

  return COMPUTER_SCIENCE_SYLLABUS;
}

function getBuiltInSyllabusTopics(subject: string) {
  return getBuiltInSyllabusCategories(subject).flatMap((category) => category.subtopics);
}

/**
 * Get current user's session
 */
async function getCurrentUser() {
  const session = await getCurrentSessionServerFn();
  if (!session?.user?.id) {
    return null;
  }
  return session.user;
}

/**
 * Get AI Hub access status for current user
 */
export const getAIHubAccessStatusFn = createServerFn({
  method: "POST",
}).handler(async () => {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return { error: "Unauthorized", enabled: false, requiresPasscode: false };
    }

    const enabled = await isAIHubEnabled(user.id);

    return {
      enabled,
      requiresPasscode: enabled,
    };
  } catch (error) {
    console.error(
      "[AI Hub] Access status error:",
      error instanceof Error ? error.message : String(error),
    );
    return { error: "Failed to check access status", enabled: false };
  }
});

/**
 * Verify AI Hub passcode with rate limiting
 */
export const verifyAIHubPasscodeFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: { passcode: string }) => data)
  .handler(async ({ data }) => {
    const passcode = data.passcode?.trim();

    try {
      const user = await getCurrentUser();
      if (!user) {
        return { error: "Unauthorized", verified: false };
      }

      const enabled = await isAIHubEnabled(user.id);
      if (!enabled) {
        return { error: "Access disabled", verified: false };
      }

      if (!passcode) {
        return { error: "Passcode is required", verified: false };
      }

      // Use rate-limited verification
      const result = await verifyAIHubPasscodeWithRateLimit(user.id, passcode);
      
      if (!result.verified) {
        return { error: result.message || "Invalid passcode", verified: false };
      }

      // Generate session token
      const token = Buffer.from(
        JSON.stringify({
          userId: user.id,
          timestamp: Date.now(),
          expiry: Date.now() + 3600000, // 1 hour
        }),
      ).toString("base64");

      return { verified: true, token };
    } catch (error) {
      console.error("Passcode verification error:", error);
      return { error: "Failed to verify passcode", verified: false };
    }
  });
  

/**
 * Generate a new university-style question
 */
export const generateQuestionFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    (data: {
      topic: string;
      categoryName?: string;
      candidateSubtopics?: string[];
      marks: number;
      questionType: "theory" | "numerical" | "auto";
      subject: string;
      customPrompt?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return { error: "Unauthorized" };
      }

      const { topic, categoryName, marks, questionType, subject, customPrompt } = data;

      // Validation
      if (!topic || ![8, 12].includes(marks) || !questionType || !subject) {
        return { error: "Invalid request parameters" };
      }

      const syllabusCategories = getBuiltInSyllabusCategories(subject);
      const selectedCategory = categoryName
        ? syllabusCategories.find((category) => category.name === categoryName)
        : syllabusCategories.find((category) => category.subtopics.includes(topic));
      const isAutoSubtopicSelection = Boolean(
        selectedCategory && topic === selectedCategory.name,
      );
      const candidateSubtopics = isAutoSubtopicSelection ? selectedCategory?.subtopics ?? [] : [];

      // Get user's progress for personalization
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

      // Check built-in syllabus topics
      const syllabusTopics = getBuiltInSyllabusTopics(subject);
      if (syllabusTopics.length > 0 && !syllabusTopics.includes(topic) && !isAutoSubtopicSelection) {
        return { error: "Topic not found in the built-in syllabus" };
      }

      // Generate question
      const { question, type, selectedTopic, modelNotices } = await generateQuestion(
        topic,
        marks,
        questionType,
        {
          ...context,
          selectedCategory: selectedCategory?.name,
          candidateSubtopics,
        },
        customPrompt,
      );

      // Check for duplicates
      const questionHash = generateQuestionHash(question);
      const isDuplicate = await hasQuestionBeenGenerated(user.id, questionHash);

      let finalQuestion = question;
      let finalType = type;
      let finalTopic = selectedTopic;
      let finalModelNotices = [...modelNotices];

      if (isDuplicate) {
        // Retry if duplicate
        const retry = await generateQuestion(
          topic,
          marks,
          questionType,
          {
            ...context,
            selectedCategory: selectedCategory?.name,
            candidateSubtopics,
          },
          customPrompt,
        );
        finalQuestion = retry.question;
        finalType = retry.type;
        finalTopic = retry.selectedTopic;
        finalModelNotices = [...finalModelNotices, ...retry.modelNotices];
      }

      // Store generated question
      await storeGeneratedQuestion(user.id, finalTopic, subject, finalQuestion, marks, finalType);

      return {
        question: finalQuestion,
        type: finalType,
        topic: finalTopic,
        modelNotices: finalModelNotices,
        marks,
        wordLimit: marks === 8 ? 125 : 200,
      };
    } catch (error) {
      console.error("Question generation error:", error);
      if (isGeminiQuotaError(error)) {
        return { error: "Daily AI quota reached. Please try again tomorrow." };
      }
      if (isGeminiUnavailableError(error)) {
        return {
          error:
            "The AI model is currently busy due to high demand. Please try again in a few seconds.",
        };
      }
      return { error: "Failed to generate question" };
    }
  });

/**
 * Evaluate student's handwritten answer
 */
export const evaluateAnswerFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    (data: {
      imageUrl: string;
      questionText: string;
      marks: number;
      topic: string;
      subject: string;
      requestId?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const requestId = data.requestId;

    try {
      const user = await getCurrentUser();
      if (!user) {
        return { error: "Unauthorized" };
      }

      const { imageUrl, questionText, marks, topic, subject } = data;

      if (!imageUrl || !questionText || ![8, 12].includes(marks)) {
        return { error: "Invalid request parameters" };
      }

      updateEvaluationProgress(requestId, {
        status: "processing",
        message: "Image received. Preparing it for AI evaluation...",
      });

      // Read the handwritten answer, evaluate it, and generate the model answer
      // in one Gemini Vision request to reduce quota usage.
      const { evaluation, modelAnswer, ocrText, modelNotices } = await evaluateAnswerFromImage(
        imageUrl,
        questionText,
        marks,
        (message) => {
          const isFallbackNotice = message.toLowerCase().includes("switching to a fallback model");
          const progressPatch: Parameters<typeof updateEvaluationProgress>[1] = {
            status: isFallbackNotice ? "switching" : "processing",
            message,
          };

          if (isFallbackNotice && isValidRequestId(requestId)) {
            const currentNotices =
              evaluationProgressByRequestId.get(requestId)?.notices ?? [];
            progressPatch.notices = [...currentNotices, message];
          }

          updateEvaluationProgress(requestId, progressPatch);
        },
      );

      updateEvaluationProgress(requestId, {
        status: "processing",
        message: "Evaluation finished. Saving your progress...",
        notices: modelNotices,
      });

      // Update progress
      await updateTopicProgress(user.id, subject, topic, evaluation.score, marks);

      // Store evaluation (only essential data for optimization)
      await storeEvaluation(
        user.id,
        topic,
        subject,
        evaluation.score,
        marks,
      );

      // Delete the pending question after successful evaluation
      await deletePendingQuestion(user.id, subject);

      updateEvaluationProgress(requestId, {
        status: "completed",
        message: "Done. Your evaluated answer is ready.",
        notices: modelNotices,
      });

      return {
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
        modelNotices,
      };
    } catch (error) {
      console.error("Answer evaluation error:", error);
      updateEvaluationProgress(requestId, {
        status: "error",
        message: "Evaluation could not be completed. Please try again.",
      });

      if (isGeminiQuotaError(error)) {
        return { error: "Daily AI quota reached. Please try again tomorrow." };
      }
      if (isGeminiUnavailableError(error)) {
        return {
          error:
            "The AI model is currently busy due to high demand. Please try again in a few seconds.",
        };
      }
      return { error: "Failed to evaluate answer" };
    }
  });

/**
 * Get user's progress for a subject
 */
export const getUserProgressFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: string) => data)
  .handler(async ({ data: subject }) => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return { error: "Unauthorized" };
      }

      const progress = await getUserProgress(user.id, subject);
      
      // Convert Map to array and calculate stats
      const topicProgressArray = Array.from(progress.topicProgress.values());
      const totalAttempts = progress.overallAttempts;
      const topicsCovered = topicProgressArray.length;
      const weakTopics = topicProgressArray.filter(
        (tp) => (tp.lastScore / 12) * 100 < 50
      ).length;

      return {
        userId: progress.userId,
        subject: progress.subject,
        topicProgress: topicProgressArray,
        overallAttempts: totalAttempts,
        overallAverageScore: progress.overallAverageScore || 0,
        topicsCovered,
        weakTopics,
        createdAt: progress.createdAt,
        updatedAt: progress.updatedAt,
      };
    } catch (error) {
      console.error("Progress fetch error:", error);
      return { error: "Failed to fetch progress" };
    }
  });

/**
 * Get weak topics for a subject
 */
export const getWeakTopicsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: string) => data)
  .handler(async ({ data: subject }) => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return { error: "Unauthorized", topics: [] };
      }

      const weakTopics = await getWeakTopics(user.id, subject);
      return { topics: weakTopics };
    } catch (error) {
      console.error("Weak topics fetch error:", error);
      return { error: "Failed to fetch weak topics", topics: [] };
    }
  });

/**
 * Get evaluation history for user
 */
export const getEvaluationHistoryFn = createServerFn({
  method: "POST",
}).handler(async () => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Unauthorized", history: [] };
    }

    const history = await getEvaluationHistory(user.id, 500);
    return { history };
  } catch (error) {
    console.error("History fetch error:", error);
    return { error: "Failed to fetch history", history: [] };
  }
});

/**
 * Get pending question for a subject
 */
export const getPendingQuestionFn = createServerFn({
  method: "POST",
})
  .inputValidator((subject: string) => subject)
  .handler(async ({ data: subject }): Promise<{ error?: string; question: any | null }> => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return { error: "Unauthorized", question: null };
      }

      const question = await getPendingQuestion(user.id, subject);
      return { question };
    } catch (error) {
      console.error("Pending question fetch error:", error);
      return { error: "Failed to fetch pending question", question: null };
    }
  });

/**
 * Clear pending question for a subject
 */
export const clearPendingQuestionFn = createServerFn({
  method: "POST",
})
  .inputValidator((subject: string) => subject)
  .handler(async ({ data: subject }): Promise<{ error?: string; success?: boolean }> => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return { error: "Unauthorized" };
      }

      await deletePendingQuestion(user.id, subject);
      return { success: true };
    } catch (error) {
      console.error("Clear pending question error:", error);
      return { error: "Failed to clear pending question" };
    }
  });

/**
 * Get syllabus topics for a subject
 */
export const getSyllabusFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: { subject: string }) => data)
  .handler(async ({ data }) => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return { error: "Unauthorized", topics: [] };
      }

      const topics = getBuiltInSyllabusTopics(data.subject);
      return { topics };
    } catch (error) {
      console.error("Syllabus fetch error:", error);
      return { error: "Failed to fetch syllabus", topics: [] };
    }
  });

/**
 * Get categorized topics for a subject
 */
export const getCategorizedTopicsFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: { subject: string }) => data)
  .handler(async ({ data }) => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return { error: "Unauthorized", categories: [] };
      }

      const categories = getBuiltInSyllabusCategories(data.subject);
      return { categories };
    } catch (error) {
      console.error("Categorized topics fetch error:", error);
      return { error: "Failed to fetch categorized topics", categories: [] };
    }
  });

/**
 * Get subtopics from a specific category
 */
export const getSubtopicsFromCategoryFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: { subject: string; categoryName: string }) => data)
  .handler(async ({ data }) => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return { error: "Unauthorized", subtopics: [] };
      }

      const category = getBuiltInSyllabusCategories(data.subject).find(
        (item) => item.name.toLowerCase() === data.categoryName.toLowerCase(),
      );
      const subtopics = category?.subtopics ?? [];
      return { subtopics };
    } catch (error) {
      console.error("Subtopics fetch error:", error);
      return { error: "Failed to fetch subtopics", subtopics: [] };
    }
  });
