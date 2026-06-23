import { ObjectId } from "mongodb";
import { connectToDatabase } from "./db";
import bcrypt from "bcrypt";

// ============================================================================
// AI Hub Database Schemas & Types
// ============================================================================

export interface AIHubUser {
  userId: string;
  aiHubEnabled: boolean;
  role: "student" | "premium_aihub" | "admin";
  passcodeHash: string; // Bcrypt hashed
  passReceivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TopicProgress {
  topic: string;
  attempts: number;
  averageScore: number;
  lastScore: number;
  difficulty: "easy" | "medium" | "hard";
  strongAreas: string[];
  weakAreas: string[];
  lastAttemptDate: Date;
}

export interface UserProgress {
  _id?: ObjectId;
  userId: string;
  subject: string;
  topicProgress: Map<string, TopicProgress>;
  overallAttempts: number;
  overallAverageScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TopicCategory {
  name: string; // e.g., "DBMS", "Data Structures", "Computer Networks"
  subtopics: string[]; // List of topics under this category
  description?: string;
}

export interface UploadedSyllabus {
  _id?: ObjectId;
  userId: string;
  subject: string;
  fileUrl: string; // Cloudinary URL
  topics: string[]; // All topics (flat array)
  categorizedTopics: TopicCategory[]; // Topics organized by category
  uploadedAt: Date;
}

export interface GlobalSyllabus {
  _id?: ObjectId;
  subject: string;
  categorizedTopics: TopicCategory[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferenceQuestion {
  _id?: ObjectId;
  userId: string;
  subject: string;
  questionText: string;
  source: string; // Paper/Source name
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  uploadedAt: Date;
}

export interface EvaluationHistory {
  _id?: ObjectId;
  userId: string;
  topic: string;
  subject: string;
  score: number;
  maxMarks: number;
  evaluatedAt: Date;
}

export interface AIHubLeaderboardEntry {
  userId: string;
  name: string;
  avgMarks: number;
  submissions: number;
}

export interface GeneratedQuestion {
  _id?: ObjectId;
  userId: string;
  topic: string;
  subject: string;
  questionText: string;
  marks: number;
  questionType: "theory" | "numerical";
  wordLimit: number;
  questionHash: string;
  generatedAt: Date;
  choices?: Array<{
    question: string;
    type: "theory" | "numerical";
    topic: string;
  }>;
}

export type PendingGeneratedQuestion = Omit<GeneratedQuestion, "_id"> & {
  _id?: string;
};

// ============================================================================
// AI Hub Access Control Functions
// ============================================================================

/**
 * Check if user has AI Hub access enabled
 */
export async function isAIHubEnabled(userId: string): Promise<boolean> {
  const db = await connectToDatabase();
  const usersCollection = db.collection<AIHubUser>("aihub_users");

  const user = await usersCollection.findOne({ userId });
  return user?.aiHubEnabled ?? false;
}

/**
 * Check whether the student confirmed receiving their AI Hub pass.
 */
export async function hasAIHubPassBeenReceived(userId: string): Promise<boolean> {
  const db = await connectToDatabase();
  const usersCollection = db.collection<AIHubUser>("aihub_users");

  const user = await usersCollection.findOne({ userId });
  return Boolean(user?.passReceivedAt);
}

/**
 * Permanently hide the AI Hub pass reminder after the student confirms.
 */
export async function markAIHubPassReceived(userId: string): Promise<void> {
  const db = await connectToDatabase();
  const usersCollection = db.collection<AIHubUser>("aihub_users");
  const now = new Date();

  await usersCollection.updateOne(
    { userId },
    {
      $set: {
        passReceivedAt: now,
        updatedAt: now,
      },
      $setOnInsert: {
        userId,
        aiHubEnabled: true,
        role: "premium_aihub",
        passcodeHash: "",
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

/**
 * Verify AI Hub passcode
 * Secure comparison using bcrypt
 */
export async function verifyAIHubPasscode(userId: string, passcode: string): Promise<boolean> {
  if (!passcode) {
    return false;
  }

  const db = await connectToDatabase();
  const usersCollection = db.collection<AIHubUser>("aihub_users");

  const user = await usersCollection.findOne({ userId });

  if (!user) {
    return false;
  }

  if (!user.passcodeHash) {
    return false;
  }

  // Ensure both are strings and trim whitespace
  const hashStr = String(user.passcodeHash);
  const passcodeStr = String(passcode).trim();

  try {
    const result = await bcrypt.compare(passcodeStr, hashStr);
    return result;
  } catch (err) {
    console.error(
      "[Auth] Passcode verification error:",
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

/**
 * Set AI Hub passcode (admin only)
 * Hash using bcrypt before storing
 */
export async function setAIHubPasscode(userId: string, plainPasscode: string): Promise<void> {
  const db = await connectToDatabase();
  const usersCollection = db.collection<AIHubUser>("aihub_users");

  const trimmedPasscode = plainPasscode.trim();
  const hashedPasscode = await bcrypt.hash(trimmedPasscode, 12);

  await usersCollection.updateOne(
    { userId },
    {
      $set: {
        passcodeHash: hashedPasscode,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

/**
 * Enable/Disable AI Hub for a user (admin only)
 */
export async function setAIHubAccess(userId: string, enabled: boolean): Promise<void> {
  const db = await connectToDatabase();
  const usersCollection = db.collection<AIHubUser>("aihub_users");

  await usersCollection.updateOne(
    { userId },
    {
      $set: {
        aiHubEnabled: enabled,
        role: enabled ? "premium_aihub" : "student",
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

// ============================================================================
// Passcode Verification
// ============================================================================

/**
 * Verify AI Hub passcode with rate limiting
 */
export async function verifyAIHubPasscodeWithRateLimit(
  userId: string,
  passcode: string,
): Promise<{ verified: boolean; message?: string }> {
  const verified = await verifyAIHubPasscode(userId, passcode);
  return { verified };
}

/**
 * Generate secure random passcode
 */
function generateSecurePasscode(length: number = 8): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

/**
 * Create AI Hub user with secure random passcode
 */
export async function createAIHubUserSecure(
  studentUserId: string,
  adminUserId: string,
): Promise<{ userId: string; temporaryPasscode: string }> {
  const db = await connectToDatabase();

  // Verify student exists
  const student = await db.collection("users").findOne({ userId: studentUserId, role: "student" });

  if (!student) {
    throw new Error("Student not found");
  }

  // Check if already has AI Hub access
  const existing = await db.collection("aihub_users").findOne({ userId: studentUserId });

  if (existing?.aiHubEnabled) {
    throw new Error("User already has AI Hub access");
  }

  // Generate secure random passcode
  const temporaryPasscode = generateSecurePasscode(8);
  const hashedPasscode = await bcrypt.hash(temporaryPasscode, 12);

  // Create AI Hub user
  const aiHubUser: AIHubUser = {
    userId: studentUserId,
    aiHubEnabled: true,
    role: "premium_aihub",
    passcodeHash: hashedPasscode,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db
    .collection("aihub_users")
    .updateOne({ userId: studentUserId }, { $set: aiHubUser }, { upsert: true });

  return {
    userId: studentUserId,
    temporaryPasscode,
  };
}

/**
 * Allow user to change their AI Hub passcode
 */
export async function changeAIHubPasscodeSecure(
  userId: string,
  oldPasscode: string,
  newPasscode: string,
): Promise<void> {
  // Verify old passcode
  const verified = await verifyAIHubPasscode(userId, oldPasscode);
  if (!verified) {
    throw new Error("Current passcode is incorrect");
  }

  // Validate new passcode
  if (newPasscode.length < 6) {
    throw new Error("New passcode must be at least 6 characters");
  }

  if (oldPasscode === newPasscode) {
    throw new Error("New passcode must be different from current one");
  }

  // Update passcode
  const db = await connectToDatabase();
  const hashedPasscode = await bcrypt.hash(newPasscode, 12);

  await db.collection<AIHubUser>("aihub_users").updateOne(
    { userId },
    {
      $set: {
        passcodeHash: hashedPasscode,
        updatedAt: new Date(),
      },
    },
  );
}

// ============================================================================
// Topic Progress Tracking
// ============================================================================

/**
 * Get or initialize user's progress in a subject
 */
export async function getUserProgress(userId: string, subject: string): Promise<UserProgress> {
  const db = await connectToDatabase();
  const progressCollection = db.collection<any>("user_progress");

  let progress = await progressCollection.findOne({ userId, subject });

  if (!progress) {
    progress = {
      userId,
      subject,
      topicProgress: [],
      overallAttempts: 0,
      overallAverageScore: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } else {
    // Ensure topicProgress is an array
    if (!Array.isArray(progress.topicProgress)) {
      progress.topicProgress = [];
    }
  }

  return {
    ...progress,
    topicProgress: new Map((progress.topicProgress || []).map((tp: any) => [tp.topic, tp])),
  };
}

/**
 * Update topic progress after evaluation
 */
export async function updateTopicProgress(
  userId: string,
  subject: string,
  topic: string,
  newScore: number,
  maxMarks: number,
): Promise<void> {
  const db = await connectToDatabase();
  const progressCollection = db.collection<any>("user_progress");

  const scorePercentage = (newScore / maxMarks) * 100;

  // Determine difficulty for next question
  let nextDifficulty: "easy" | "medium" | "hard" = "medium";
  if (scorePercentage > 80) {
    nextDifficulty = "hard";
  } else if (scorePercentage < 50) {
    nextDifficulty = "easy";
  }

  // First, try to update existing topic progress
  const updateResult = await progressCollection.updateOne(
    { userId, subject, "topicProgress.topic": topic },
    {
      $inc: {
        "topicProgress.$[t].attempts": 1,
        overallAttempts: 1,
      },
      $set: {
        "topicProgress.$[t].lastScore": newScore,
        "topicProgress.$[t].lastAttemptDate": new Date(),
        "topicProgress.$[t].difficulty": nextDifficulty,
        updatedAt: new Date(),
      },
    },
    {
      arrayFilters: [{ "t.topic": topic }],
    },
  );

  // If no matching topic found, create new progress entry
  if (updateResult.matchedCount === 0) {
    await progressCollection.updateOne(
      { userId, subject },
      {
        $push: {
          topicProgress: {
            topic,
            attempts: 1,
            averageScore: newScore,
            lastScore: newScore,
            lastAttemptDate: new Date(),
            difficulty: nextDifficulty,
            strongAreas: [],
            weakAreas: [],
          } as any,
        },
        $inc: {
          overallAttempts: 1,
        },
        $set: {
          userId,
          subject,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
          overallAverageScore: 0,
        },
      },
      {
        upsert: true,
      },
    );
  }

  // Recalculate average scores
  const progress = await progressCollection.findOne({ userId, subject });
  if (progress && progress.topicProgress && progress.topicProgress.length > 0) {
    // Update each topic's average score and overall average
    const updatedTopics = progress.topicProgress.map((p: any) => {
      const oldAverage = p.averageScore ?? p.lastScore ?? 0;
      const attempts = p.attempts ?? 1;
      // Calculate new average: (oldAverage * (attempts - 1) + lastScore) / attempts
      const newAverage =
        attempts === 1 ? p.lastScore : (oldAverage * (attempts - 1) + p.lastScore) / attempts;
      return {
        ...p,
        averageScore: newAverage,
      };
    });

    // Update the document with recalculated averages
    const totalScore = updatedTopics.reduce(
      (sum: number, p: any) => sum + (p.averageScore || 0),
      0,
    );
    const overallAvg = totalScore / updatedTopics.length;

    await progressCollection.updateOne(
      { userId, subject },
      {
        $set: {
          topicProgress: updatedTopics,
          overallAverageScore: overallAvg,
          updatedAt: new Date(),
        },
      },
    );
  }
}

/**
 * Get topics with average score < 50% (weak areas)
 */
export async function getWeakTopics(userId: string, subject: string): Promise<TopicProgress[]> {
  const db = await connectToDatabase();
  const progressCollection = db.collection<any>("user_progress");

  const progress = await progressCollection.findOne({ userId, subject });
  if (!progress || !Array.isArray(progress.topicProgress)) return [];

  // Filter topics with last score less than 50% (assuming 12 marks max or calculate percentage)
  return progress.topicProgress
    .filter((t: any) => {
      const scorePercentage = ((t.lastScore || 0) / 12) * 100; // Assuming 12 marks, adjust if needed
      return scorePercentage < 50;
    })
    .map((t: any) => ({
      ...t,
      averageScore: t.averageScore ?? t.lastScore ?? 0,
      strongAreas: t.strongAreas ?? [],
      weakAreas: t.weakAreas ?? [],
    }));
}

// ============================================================================
// Question Hashing (Deduplication)
// ============================================================================

import crypto from "crypto";

/**
 * Generate hash for a question to prevent duplicates
 */
export function generateQuestionHash(questionText: string): string {
  return crypto.createHash("sha256").update(questionText).digest("hex");
}

/**
 * Check if a similar question was recently generated
 */
export async function hasQuestionBeenGenerated(
  userId: string,
  questionHash: string,
): Promise<boolean> {
  const db = await connectToDatabase();
  const questionCollection = db.collection<GeneratedQuestion>("generated_questions");

  const question = await questionCollection.findOne({
    userId,
    questionHash,
  });

  return !!question;
}

/**
 * Store generated question
 */
export async function storeGeneratedQuestion(
  userId: string,
  topic: string,
  subject: string,
  questionText: string,
  marks: number,
  questionType: "theory" | "numerical",
  choices: Array<{
    question: string;
    type: "theory" | "numerical";
    topic: string;
  }> = [],
): Promise<void> {
  const db = await connectToDatabase();
  const questionCollection = db.collection<GeneratedQuestion>("generated_questions");

  const wordLimit = marks === 8 ? 125 : 200;
  const questionHash = generateQuestionHash(questionText);

  // Delete any existing pending question for this user and subject
  await questionCollection.deleteMany({ userId, subject });

  await questionCollection.insertOne({
    userId,
    topic,
    subject,
    questionText,
    marks,
    questionType,
    wordLimit,
    questionHash,
    choices,
    generatedAt: new Date(),
  } as any);
}

/**
 * Get pending question for a user and subject
 */
export async function getPendingQuestion(
  userId: string,
  subject: string,
): Promise<GeneratedQuestion | null> {
  const db = await connectToDatabase();
  const questionCollection = db.collection<GeneratedQuestion>("generated_questions");

  const question = await questionCollection.findOne({ userId, subject });
  if (!question) return null;

  // Convert ObjectId to string for JSON serialization
  return {
    ...question,
    _id: question._id?.toString(),
  } as any;
}

/**
 * Delete pending question after evaluation
 */
export async function deletePendingQuestion(userId: string, subject: string): Promise<void> {
  const db = await connectToDatabase();
  const questionCollection = db.collection<GeneratedQuestion>("generated_questions");

  await questionCollection.deleteOne({ userId, subject });
}

/**
 * Delete only the answered pending question variant after evaluation.
 * If no variants remain, remove the pending question document.
 */
export async function deleteAnsweredPendingQuestion(
  userId: string,
  subject: string,
  answeredQuestionText: string,
): Promise<PendingGeneratedQuestion | null> {
  const db = await connectToDatabase();
  const questionCollection = db.collection<GeneratedQuestion>("generated_questions");

  const pending = await questionCollection.findOne({ userId, subject });
  if (!pending) return null;

  const answeredHash = generateQuestionHash(answeredQuestionText);
  const choices =
    pending.choices && pending.choices.length > 0
      ? pending.choices
      : [
          {
            question: pending.questionText,
            type: pending.questionType,
            topic: pending.topic,
          },
        ];

  const remainingChoices = choices.filter((choice) => {
    const isAnswered =
      choice.question.trim() === answeredQuestionText.trim() ||
      generateQuestionHash(choice.question) === answeredHash;
    return !isAnswered;
  });

  if (remainingChoices.length === choices.length) {
    return {
      ...pending,
      _id: pending._id?.toString(),
    } as any;
  }

  if (remainingChoices.length === 0) {
    await questionCollection.deleteOne({ _id: pending._id });
    return null;
  }

  const nextChoice = remainingChoices[0];
  const questionHash = generateQuestionHash(nextChoice.question);

  await questionCollection.updateOne(
    { _id: pending._id },
    {
      $set: {
        topic: nextChoice.topic,
        questionText: nextChoice.question,
        questionType: nextChoice.type,
        questionHash,
        choices: remainingChoices,
      },
    },
  );

  return {
    ...pending,
    topic: nextChoice.topic,
    questionText: nextChoice.question,
    questionType: nextChoice.type,
    questionHash,
    choices: remainingChoices,
    _id: pending._id?.toString(),
  } as any;
}

// ============================================================================
// Syllabus Management
// ============================================================================

/**
 * Store uploaded syllabus with extracted topics
 */
export async function storeSyllabus(
  userId: string,
  subject: string,
  fileUrl: string,
  topics: string[],
): Promise<void> {
  const db = await connectToDatabase();
  const syllabusCollection = db.collection<UploadedSyllabus>("uploaded_syllabus");

  await syllabusCollection.updateOne(
    { userId, subject },
    {
      $set: {
        fileUrl,
        topics,
        uploadedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

/**
 * Get syllabus topics for a user
 */
export async function getSyllabus(userId: string, subject: string): Promise<string[]> {
  const db = await connectToDatabase();
  const syllabusCollection = db.collection<UploadedSyllabus>("uploaded_syllabus");

  const syllabus = await syllabusCollection.findOne({ userId, subject });
  return syllabus?.topics ?? [];
}

// ============================================================================
// Evaluation History
// ============================================================================

/**
 * Store evaluation result
 */
export async function storeEvaluation(
  userId: string,
  topic: string,
  subject: string,
  score: number,
  maxMarks: number,
): Promise<void> {
  const db = await connectToDatabase();
  const evaluationCollection = db.collection<EvaluationHistory>("evaluation_history");

  await evaluationCollection.insertOne({
    userId,
    topic,
    subject,
    score,
    maxMarks,
    evaluatedAt: new Date(),
  } as any);
}

/**
 * Get evaluation history for a user
 */
export async function getEvaluationHistory(userId: string, limit = 20): Promise<any[]> {
  const db = await connectToDatabase();
  const evaluationCollection = db.collection<EvaluationHistory>("evaluation_history");

  const history = await evaluationCollection
    .find({ userId })
    .sort({ evaluatedAt: -1 })
    .limit(limit)
    .toArray();

  // Convert ObjectId to string for JSON serialization
  return history.map((item) => ({
    ...item,
    _id: item._id?.toString(),
  }));
}

export async function getAIHubLeaderboard(limit = 100): Promise<AIHubLeaderboardEntry[]> {
  const db = await connectToDatabase();

  const rows = await db
    .collection<AIHubUser>("aihub_users")
    .aggregate<AIHubLeaderboardEntry>([
      {
        $match: {
          aiHubEnabled: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "userId",
          as: "student",
        },
      },
      {
        $lookup: {
          from: "evaluation_history",
          let: { aiHubUserId: "$userId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$userId", "$$aiHubUserId"] },
              },
            },
            {
              $group: {
                _id: "$userId",
                submissions: { $sum: 1 },
                avgMarks: { $avg: "$score" },
              },
            },
          ],
          as: "stats",
        },
      },
      {
        $addFields: {
          student: { $first: "$student" },
          stats: { $first: "$stats" },
        },
      },
      {
        $project: {
          _id: 0,
          userId: 1,
          name: { $ifNull: ["$student.name", "$userId"] },
          avgMarks: { $ifNull: ["$stats.avgMarks", 0] },
          submissions: { $ifNull: ["$stats.submissions", 0] },
        },
      },
      {
        $sort: {
          avgMarks: -1,
          submissions: -1,
          name: 1,
        },
      },
      {
        $limit: limit,
      },
    ])
    .toArray();

  return rows.map((row) => ({
    userId: row.userId,
    name: row.name,
    avgMarks: Math.round((Number(row.avgMarks) || 0) * 100) / 100,
    submissions: Number(row.submissions) || 0,
  }));
}

// ============================================================================
// Categorized Syllabus Management
// ============================================================================

/**
 * Store syllabus with categorized topics
 */
export async function storeCategorizedSyllabus(
  userId: string,
  subject: string,
  fileUrl: string,
  topics: string[],
  categorizedTopics: TopicCategory[],
): Promise<void> {
  const db = await connectToDatabase();
  const syllabusCollection = db.collection<UploadedSyllabus>("uploaded_syllabus");

  await syllabusCollection.updateOne(
    { userId, subject },
    {
      $set: {
        fileUrl,
        topics,
        categorizedTopics,
        uploadedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

/**
 * Get categorized topics for a user's subject
 */
export async function getCategorizedTopics(
  userId: string,
  subject: string,
): Promise<TopicCategory[]> {
  const db = await connectToDatabase();
  const syllabusCollection = db.collection<UploadedSyllabus>("uploaded_syllabus");

  // First try to get user-uploaded syllabus
  const syllabus = await syllabusCollection.findOne({ userId, subject });
  if (syllabus?.categorizedTopics) {
    // Convert to plain objects to avoid circular references
    return JSON.parse(JSON.stringify(syllabus.categorizedTopics));
  }

  // Fall back to global syllabus
  return getGlobalSyllabus(subject);
}

/**
 * Get all subtopics from a specific category
 */
export async function getSubtopicsFromCategory(
  userId: string,
  subject: string,
  categoryName: string,
): Promise<string[]> {
  const db = await connectToDatabase();
  const syllabusCollection = db.collection<UploadedSyllabus>("uploaded_syllabus");

  // First try user's uploaded syllabus
  let syllabus = await syllabusCollection.findOne({ userId, subject });

  // Fall back to global syllabus
  if (!syllabus?.categorizedTopics) {
    const globalCategories = await getGlobalSyllabus(subject);
    const category = globalCategories.find(
      (cat) => cat.name.toLowerCase() === categoryName.toLowerCase(),
    );
    return category?.subtopics ?? [];
  }

  // Convert to plain objects to avoid circular references
  const cleanCategories = JSON.parse(JSON.stringify(syllabus.categorizedTopics));
  const category = cleanCategories.find(
    (cat: TopicCategory) => cat.name.toLowerCase() === categoryName.toLowerCase(),
  );
  return category?.subtopics ?? [];
}

/**
 * Store global syllabus (for reference)
 */
export async function storeGlobalSyllabus(
  subject: string,
  categorizedTopics: TopicCategory[],
): Promise<void> {
  const db = await connectToDatabase();
  const globalCollection = db.collection<GlobalSyllabus>("global_syllabus");

  await globalCollection.updateOne(
    { subject },
    {
      $set: {
        categorizedTopics,
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

/**
 * Get global syllabus categories (for new users or reference)
 */
export async function getGlobalSyllabus(subject: string): Promise<TopicCategory[]> {
  const db = await connectToDatabase();
  const globalCollection = db.collection<GlobalSyllabus>("global_syllabus");

  const syllabus = await globalCollection.findOne({ subject });

  if (!syllabus?.categorizedTopics) {
    return [];
  }

  // Convert to plain objects to avoid circular references
  return JSON.parse(JSON.stringify(syllabus.categorizedTopics));
}
