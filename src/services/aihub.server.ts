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
  getAIHubLeaderboard,
  getPendingQuestion,
  deletePendingQuestion,
  deleteAnsweredPendingQuestion,
} from "@/server/aihub";
import { COMPUTER_SCIENCE_SYLLABUS } from "@/server/seed-computer-syllabus";
import {
  generateQuestion,
  evaluateAnswerFromImage,
  isGeminiQuotaError,
  isGeminiUnavailableError,
} from "@/server/gemini.server";
import { getCurrentSessionServerFn } from "@/services/auth.functions";
import { connectToDatabase } from "@/server/db";

interface GeneratedQuestionChoice {
  question: string;
  type: "theory" | "numerical";
  topic: string;
}

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

function isValidRequestId(requestId?: string): requestId is string {
  return typeof requestId === "string" && /^[a-zA-Z0-9_-]{8,100}$/.test(requestId);
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

function buildQuestionVariantPrompt(
  customPrompt: string | undefined,
  variantIndex: number,
  previousQuestions: string[] = [],
  variantType?: "theory" | "numerical" | "auto",
  requiresDifferentSubtopic?: boolean,
) {
  const basePrompt = customPrompt?.trim();
  const previousQuestionBlock = previousQuestions.length
    ? `Already generated questions for this click:
${previousQuestions.map((question, index) => `${index + 1}. ${question}`).join("\n")}

Do NOT generate a paraphrase of any of these. The next question must require a meaningfully different answer, with a different learning objective, command verb, examples/data, or sub-concept inside the same topic.`
    : "";
  const variantInstruction =
    variantIndex === 0
      ? "Create the strongest primary version of this question."
      : `Create hidden swap question ${variantIndex + 1}. Keep it related to the same topic/subtopic and marks, but test a different angle so a student cannot reuse the same answer. Examples of valid variation: concept explanation vs application, comparison vs design/use-case, algorithm trace vs complexity, different numerical dataset, different sub-part focus.`;
  const typeInstruction =
    variantType && variantType !== "auto"
      ? `This variant must be a ${variantType} question.`
      : "";
  const subtopicInstruction = requiresDifferentSubtopic
    ? "Use a different subtopic than the primary question, while still staying tightly related to the same overall topic."
    : "";

  return [basePrompt, previousQuestionBlock, variantInstruction, typeInstruction, subtopicInstruction]
    .filter(Boolean)
    .join("\n\n");
}

function inferRequestedVariantTypes(
  customPrompt: string | undefined,
  progressiveCustomPrompt: string | undefined,
  fallbackQuestionType: "theory" | "numerical" | "auto",
): Array<"theory" | "numerical" | "auto"> {
  const promptText = [customPrompt, progressiveCustomPrompt].filter(Boolean).join("\n").toLowerCase();
  const mentionedTypes = [...promptText.matchAll(/\b(numerical|theory)\b/g)].map((match) =>
    match[1] === "numerical" ? "numerical" : "theory",
  );
  const wantsMixedTypes =
    mentionedTypes.length >= 2 && /\b(and|plus|with|mixed|both|one|1|two|2)\b/.test(promptText);

  if (wantsMixedTypes && mentionedTypes.length >= 2) {
    return [mentionedTypes[0], mentionedTypes[1]];
  }

  return [fallbackQuestionType, fallbackQuestionType];
}

function isGeneratedQuestionUsable(question: string) {
  return Boolean(
    question &&
    question.trim().length >= 20 &&
    !question.toLowerCase().includes("unable to generate question"),
  );
}

/**
 * Get live progress for a running handwritten answer evaluation.
 */
export const getEvaluationProgressFn = createServerFn({
  method: "POST",
})
  .validator((data: { requestId: string }) => data)
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
  .validator((data: { passcode: string }) => data)
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
  .validator(
    (data: {
      topic?: string;
      categoryName?: string;
      candidateSubtopics?: string[];
      marks: number;
      questionType: "theory" | "numerical" | "auto";
      subject: string;
      customPrompt?: string;
      progressiveCustomPrompt?: string;
      includeProgressiveSubtopic?: boolean;
      generationMode?: "syllabus" | "custom";
      sourceLabel?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        return { error: "Unauthorized" };
      }

      const {
        topic,
        categoryName,
        marks,
        questionType,
        subject,
        customPrompt,
        progressiveCustomPrompt,
        includeProgressiveSubtopic,
        generationMode,
        sourceLabel,
      } = data;

      const customInstructionMode = Boolean(
        customPrompt?.trim() || progressiveCustomPrompt?.trim() || generationMode === "custom",
      );
      const customTopicSeed = [customPrompt?.trim(), progressiveCustomPrompt?.trim()]
        .filter(Boolean)
        .join(" | ");
      const resolvedTopic = topic?.trim() || (customInstructionMode ? customTopicSeed || "Custom prompt request" : "");

      // Validation
      if (!resolvedTopic && !customInstructionMode) {
        return { error: "Invalid request parameters" };
      }
      if (![8, 12].includes(marks) || !questionType || !subject) {
        return { error: "Invalid request parameters" };
      }

      const syllabusCategories = getBuiltInSyllabusCategories(subject);
      const selectedCategory = categoryName
        ? syllabusCategories.find((category) => category.name === categoryName)
        : resolvedTopic
            ? syllabusCategories.find((category) => category.subtopics.includes(resolvedTopic))
            : undefined;
      const isAutoSubtopicSelection = Boolean(selectedCategory && resolvedTopic === selectedCategory.name);
      const candidateSubtopics = isAutoSubtopicSelection ? (selectedCategory?.subtopics ?? []) : [];

      // Get user's progress for personalization
      const progress = await getUserProgress(user.id, subject);
      const topicProgress = progress.topicProgress?.get(resolvedTopic);

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
      if (
        !customInstructionMode &&
        syllabusTopics.length > 0 &&
        !syllabusTopics.includes(resolvedTopic) &&
        !isAutoSubtopicSelection
      ) {
        return { error: "Topic not found in the built-in syllabus" };
      }

      const generationContext = {
        ...context,
        selectedCategory: selectedCategory?.name,
        candidateSubtopics,
      };
      const generatedChoices: GeneratedQuestionChoice[] = [];
      const generatedHashes = new Set<string>();
      let finalModelNotices: string[] = [];

      const targetChoiceCount = 2;
      const maxGenerationAttempts = 4;
      const requestedVariantTypes = inferRequestedVariantTypes(
        customPrompt,
        progressiveCustomPrompt,
        questionType,
      );

      for (
        let i = 0;
        i < maxGenerationAttempts && generatedChoices.length < targetChoiceCount;
        i++
      ) {
        const isSecondaryVariant = i === 1;
        const useDifferentSubtopic = Boolean(
          isSecondaryVariant && includeProgressiveSubtopic && generationContext.candidateSubtopics?.length,
        );
        let variantTopic: string;
        if (i === 0) {
          variantTopic = resolvedTopic;
        } else if (useDifferentSubtopic) {
          const candidateTopics = generationContext.candidateSubtopics.filter(
            (s: string) => s !== resolvedTopic && s !== generatedChoices[0]?.topic,
          );
          variantTopic = candidateTopics.length
            ? candidateTopics[Math.floor(Math.random() * candidateTopics.length)]
            : generatedChoices[0]?.topic ?? resolvedTopic;
        } else {
          variantTopic = generatedChoices[0]?.topic ?? resolvedTopic;
        }

        const variantQuestionType = isSecondaryVariant
          ? requestedVariantTypes[1] ?? questionType
          : requestedVariantTypes[0] ?? questionType;
        const variantContext = {
          ...context,
          selectedCategory: selectedCategory?.name,
          candidateSubtopics: useDifferentSubtopic ? generationContext.candidateSubtopics ?? [] : [],
        };
        const variantPrompt = [
          isSecondaryVariant && progressiveCustomPrompt?.trim()
            ? progressiveCustomPrompt
            : customPrompt,
          useDifferentSubtopic
            ? "This is the progressive second question. Use a different subtopic from the primary question and keep it closely related to the same topic."
            : undefined,
          variantQuestionType === "auto"
            ? undefined
            : `Ensure this variant is a ${variantQuestionType} question.`,
        ]
          .filter(Boolean)
          .join("\n\n");

        const result = await generateQuestion(
          variantTopic,
          marks,
          variantQuestionType,
          variantContext,
          buildQuestionVariantPrompt(
            variantPrompt,
            generatedChoices.length,
            generatedChoices.map((choice) => choice.question),
            variantQuestionType,
            useDifferentSubtopic,
          ),
        );

        finalModelNotices = [...finalModelNotices, ...result.modelNotices];

        if (!isGeneratedQuestionUsable(result.question)) {
          continue;
        }

        const choiceHash = generateQuestionHash(result.question);
        if (generatedHashes.has(choiceHash)) {
          continue;
        }

        generatedHashes.add(choiceHash);
        generatedChoices.push({
          question: result.question,
          type: result.type,
          topic: result.selectedTopic,
        });
      }

      if (generatedChoices.length === 0) {
        return { error: "Failed to generate question" };
      }

      // Check the primary stored question for duplicates; alternatives remain response-only.
      let primaryChoice = generatedChoices[0];
      const questionHash = generateQuestionHash(primaryChoice.question);
      const isDuplicate = await hasQuestionBeenGenerated(user.id, questionHash);

      if (isDuplicate) {
        const retry = await generateQuestion(
          primaryChoice.topic,
          marks,
          primaryChoice.type,
          {
            ...context,
            selectedCategory: selectedCategory?.name,
            candidateSubtopics: [],
          },
          buildQuestionVariantPrompt(
            customPrompt,
            generatedChoices.length,
            generatedChoices.map((choice) => choice.question),
            primaryChoice.type,
          ),
        );
        finalModelNotices = [...finalModelNotices, ...retry.modelNotices];

        if (isGeneratedQuestionUsable(retry.question)) {
          primaryChoice = {
            question: retry.question,
            type: retry.type,
            topic: retry.selectedTopic,
          };
          generatedChoices[0] = primaryChoice;
        }
      }

      // Store generated question
      const effectiveGenerationMode: "syllabus" | "custom" = customInstructionMode ? "custom" : "syllabus";
      await storeGeneratedQuestion(
        user.id,
        primaryChoice.topic,
        subject,
        primaryChoice.question,
        marks,
        primaryChoice.type,
        generatedChoices,
        effectiveGenerationMode,
        sourceLabel || primaryChoice.topic || resolvedTopic || "Custom prompt request",
      );

      return {
        question: primaryChoice.question,
        type: primaryChoice.type,
        topic: primaryChoice.topic,
        choices: generatedChoices,
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
  .validator(
    (data: {
      imageUrl: string;
      imageUrls?: string[];
      questionText: string;
      marks: number;
      topic: string;
      subject: string;
      requestId?: string;
      generationMode?: "syllabus" | "custom";
      sourceLabel?: string;
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
      const imageUrls = (data.imageUrls?.length ? data.imageUrls : [imageUrl]).filter(Boolean);

      if (
        imageUrls.length === 0 ||
        imageUrls.length > 2 ||
        !questionText ||
        ![8, 12].includes(marks)
      ) {
        return { error: "Invalid request parameters" };
      }

      updateEvaluationProgress(requestId, {
        status: "processing",
        message: `Image${imageUrls.length > 1 ? "s" : ""} received. Preparing for AI evaluation...`,
      });

      // Read the handwritten answer, evaluate it, and generate the model answer
      // in one Gemini Vision request to reduce quota usage.
      const { evaluation, modelAnswer, ocrText, modelNotices } = await evaluateAnswerFromImage(
        imageUrls,
        questionText,
        marks,
        (message) => {
          const isFallbackNotice = message.toLowerCase().includes("switching to a fallback model");
          const progressPatch: Parameters<typeof updateEvaluationProgress>[1] = {
            status: isFallbackNotice ? "switching" : "processing",
            message,
          };

          if (isFallbackNotice && isValidRequestId(requestId)) {
            const currentNotices = evaluationProgressByRequestId.get(requestId)?.notices ?? [];
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

      const evaluationMode = data.generationMode === "custom" ? "custom" : "syllabus";
      const evaluationSourceLabel = data.sourceLabel || topic || "Custom prompt request";

      // Update progress only for syllabus-based work; custom prompt sessions stay separate.
      if (evaluationMode === "syllabus") {
        await updateTopicProgress(user.id, subject, topic, evaluation.score, marks);
      }

      // Store evaluation (only essential data for optimization)
      await storeEvaluation(
        user.id,
        topic,
        subject,
        evaluation.score,
        marks,
        evaluationMode,
        evaluationSourceLabel,
      );

      // Keep unanswered variants pending; remove only the question that was evaluated.
      const pendingQuestion = await deleteAnsweredPendingQuestion(user.id, subject, questionText);

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
        pendingQuestion,
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
  .validator((data: string) => data)
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
      const weakTopics = topicProgressArray.filter((tp) => (tp.lastScore / 12) * 100 < 50).length;

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
  .validator((data: string) => data)
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

export const getAIHubLeaderboardFn = createServerFn({
  method: "POST",
}).handler(async () => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Unauthorized", leaderboard: [] };
    }

    const enabled = await isAIHubEnabled(user.id);
    if (!enabled) {
      return { error: "Access disabled", leaderboard: [] };
    }

    const leaderboard = await getAIHubLeaderboard(100);
    return { leaderboard };
  } catch (error) {
    console.error("AI Hub leaderboard fetch error:", error);
    return { error: "Failed to fetch AI Hub leaderboard", leaderboard: [] };
  }
});

/**
 * Get pending question for a subject
 */
export const getPendingQuestionFn = createServerFn({
  method: "POST",
})
  .validator((subject: string) => subject)
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
  .validator((subject: string) => subject)
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
  .validator((data: { subject: string }) => data)
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
  .validator((data: { subject: string }) => data)
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
  .validator((data: { subject: string; categoryName: string }) => data)
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
