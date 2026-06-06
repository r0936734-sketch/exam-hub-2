"use server";

import { createServerFn } from "@tanstack/react-start";
import {
  isAIHubEnabled,
  verifyAIHubPasscode,
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
import { generateQuestion, evaluateAnswer, extractTextFromImage } from "@/server/gemini.server";
import { getCurrentSessionServerFn } from "@/services/auth.functions";

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
 * Verify AI Hub passcode
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

      const verified = await verifyAIHubPasscode(user.id, passcode);
      if (!verified) {
        return { error: "Invalid passcode", verified: false };
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

      const { topic, marks, questionType, subject, customPrompt } = data;

      // Validation
      if (!topic || ![8, 12].includes(marks) || !questionType || !subject) {
        return { error: "Invalid request parameters" };
      }

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
      if (syllabusTopics.length > 0 && !syllabusTopics.includes(topic)) {
        return { error: "Topic not found in the built-in syllabus" };
      }

      // Generate question
      const { question, type } = await generateQuestion(topic, marks, questionType, context, customPrompt);

      // Check for duplicates
      const questionHash = generateQuestionHash(question);
      const isDuplicate = await hasQuestionBeenGenerated(user.id, questionHash);

      let finalQuestion = question;
      let finalType = type;

      if (isDuplicate) {
        // Retry if duplicate
        const retry = await generateQuestion(topic, marks, questionType, context, customPrompt);
        finalQuestion = retry.question;
        finalType = retry.type;
      }

      // Store generated question
      await storeGeneratedQuestion(user.id, topic, subject, finalQuestion, marks, finalType);

      return {
        question: finalQuestion,
        type: finalType,
        marks,
        wordLimit: marks === 8 ? 125 : 200,
      };
    } catch (error) {
      console.error("Question generation error:", error);
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
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return { error: "Unauthorized" };
      }

      const { imageUrl, questionText, marks, topic, subject } = data;

      if (!imageUrl || !questionText || ![8, 12].includes(marks)) {
        return { error: "Invalid request parameters" };
      }

      // Extract text from image
      const ocrText = await extractTextFromImage(imageUrl);

      // Evaluate answer
      const { evaluation, modelAnswer } = await evaluateAnswer(ocrText, questionText, marks);

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
      };
    } catch (error) {
      console.error("Answer evaluation error:", error);
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

    const history = await getEvaluationHistory(user.id);
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
