import { Db, ObjectId } from "mongodb";
import { deleteSubmissionsWithImages } from "@/server/cleanup";

export async function generateNextUserId(db: Db): Promise<string> {
  const prefix = "STU";
  const users = await db
    .collection<User>("users")
    .find({ role: "student", userId: { $regex: `^${prefix}\\d+$` } })
    .project<{ userId: string }>({ userId: 1, _id: 0 })
    .toArray();

  const highest = users.reduce((max, user) => {
    const value = Number.parseInt(user.userId.slice(prefix.length), 10);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);

  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
}

export async function getNextSequentialId(db: Db): Promise<string> {
  return generateNextUserId(db);
}

export interface User {
  _id?: ObjectId;
  userId: string;
  name: string;
  password: string;
  role: "student";
  avgMarks: number;
  totalTests: number;
  active?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PROTECTED_STUDENT_IDS = new Set(["STU001"]);

function isProtectedStudentId(userId: string): boolean {
  return PROTECTED_STUDENT_IDS.has(userId.trim().toUpperCase());
}

export async function createUser(
  db: Db,
  data: { name: string; password: string; role: "student" },
): Promise<User> {
  const name = data.name.trim();
  const password = data.password.trim();

  if (!name || !password) {
    throw new Error("name and password are required");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const userId = await generateNextUserId(db);

  const user: User = {
    userId,
    name,
    password: password,
    role: data.role,
    avgMarks: 0,
    totalTests: 0,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection<User>("users").insertOne(user);
  return user;
}

export async function findUserByUserId(db: Db, userId: string): Promise<User | null> {
  return db.collection<User>("users").findOne({
    role: "student",
    userId: userId.trim().toUpperCase(),
  });
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function findStudentByUserIdOrName(db: Db, identifier: string): Promise<User | null> {
  const value = identifier.trim();
  if (!value) return null;

  const userIdMatch = await db
    .collection<User>("users")
    .findOne({ role: "student", userId: value.toUpperCase() });

  if (userIdMatch) return userIdMatch;

  const nameMatches = await db
    .collection<User>("users")
    .find({
      role: "student",
      name: { $regex: `^${escapeRegex(value)}$`, $options: "i" },
    })
    .limit(2)
    .toArray();

  if (nameMatches.length > 1) {
    throw new Error("Multiple students share this name. Use the student ID instead.");
  }

  return nameMatches[0] ?? null;
}

export async function getStudentProfileByUserId(
  db: Db,
  userId: string,
): Promise<{
  userId: string;
  name: string;
  avgMarks: number;
  rank: number | null;
  totalStudents: number;
} | null> {
  const normalizedUserId = userId.trim().toUpperCase();
  const student = await db
    .collection<User>("users")
    .findOne({ role: "student", userId: normalizedUserId });

  if (!student || student.active === false) return null;

  const students = await db
    .collection<User>("users")
    .find({ role: "student", active: { $ne: false } })
    .sort({ avgMarks: -1, totalTests: -1, userId: 1 })
    .project<{ userId: string }>({ userId: 1, _id: 0 })
    .toArray();

  const rankIndex = students.findIndex((row) => row.userId === normalizedUserId);

  return {
    userId: student.userId,
    name: student.name,
    avgMarks: student.avgMarks,
    rank: rankIndex >= 0 ? rankIndex + 1 : null,
    totalStudents: students.length,
  };
}

export async function getAllStudents(db: Db): Promise<
  Array<{
    id: string;
    userId: string;
    name: string;
    password?: string;
    protected: boolean;
    active: boolean;
    createdAt: string;
  }>
> {
  return db
    .collection<User>("users")
    .find({ role: "student" })
    .sort({ createdAt: -1 })
    .toArray()
    .then((users) =>
      users.map((user) => {
        // Hide password for STU001 - not visible to any admin
        const isProtectedUser = isProtectedStudentId(user.userId);
        return {
          id: user.userId,
          userId: user.userId,
          name: user.name,
          password: isProtectedUser ? undefined : user.password,
          protected: isProtectedUser,
          active: user.active !== false,
          createdAt: user.createdAt.toISOString(),
        };
      }),
    );
}

export async function updateStudentActive(
  db: Db,
  userId: string,
  active: boolean,
): Promise<boolean> {
  if (isProtectedStudentId(userId)) {
    throw new Error("This protected student account cannot be deactivated");
  }

  const result = await db.collection<User>("users").updateOne(
    { userId, role: "student" },
    {
      $set: {
        active,
        updatedAt: new Date(),
      },
    },
  );

  return result.matchedCount > 0;
}

export async function deleteStudent(db: Db, userId: string): Promise<boolean> {
  const normalizedUserId = userId.trim().toUpperCase();

  if (isProtectedStudentId(normalizedUserId)) {
    throw new Error("This protected student account cannot be deleted");
  }

  const student = await db.collection<User>("users").findOne({
    userId: normalizedUserId,
    role: "student",
  });

  if (!student) return false;

  // Remove stored answer images before deleting the student's submission records.
  await deleteSubmissionsWithImages(db, { studentId: normalizedUserId });

  const result = await db.collection<User>("users").deleteOne({
    userId: normalizedUserId,
    role: "student",
  });

  return result.deletedCount > 0;
}

export async function getLeaderboard(
  db: Db,
  limit: number = 100,
): Promise<
  Array<{
    rank: number;
    userId: string;
    name: string;
    avgMarks: number;
    totalTests: number;
  }>
> {
  return db
    .collection("users")
    .find({ role: "student", active: { $ne: false } })
    .sort({ avgMarks: -1, totalTests: -1, userId: 1 })
    .limit(limit)
    .toArray()
    .then((users) =>
      users.map((user, index) => ({
        rank: index + 1,
        userId: user.userId,
        name: user.name,
        avgMarks: user.avgMarks,
        totalTests: user.totalTests,
      })),
    );
}

  /**
   * Leaderboard based on `user_progress` collection.
   * Shows only users who have progress records (AI Hub users).
   */
  export async function getLeaderboardFromProgress(
    db: Db,
    subject?: string,
    limit: number = 100,
  ): Promise<
    Array<{
      userId: string;
      name: string;
      avgMarks: number;
      submissions: number;
    }>
  > {
    const filter: any = {};
    if (subject) filter.subject = subject;

    // Sort by overallAverageScore descending, then overallAttempts desc
    const rows = await db
      .collection("user_progress")
      .find(filter)
      .sort({ overallAverageScore: -1, overallAttempts: -1 })
      .limit(limit)
      .toArray();

    // Fetch names for these userIds
    const ids = rows.map((r: any) => r.userId);
    const users = await db
      .collection("users")
      .find({ userId: { $in: ids } })
      .project<{ userId: string; name: string }>({ userId: 1, name: 1, _id: 0 })
      .toArray();
    const nameById = new Map(users.map((u) => [u.userId, u.name]));

    return rows.map((r: any) => ({
      userId: r.userId,
      name: nameById.get(r.userId) ?? r.userId,
      avgMarks: typeof r.overallAverageScore === "number" ? r.overallAverageScore : 0,
      submissions: typeof r.overallAttempts === "number" ? r.overallAttempts : 0,
    }));
  }

export async function updateUserAvgMarks(
  db: Db,
  userId: string,
  totalMarks: number,
): Promise<void> {
  const user = await findUserByUserId(db, userId);
  if (!user) throw new Error("User not found");

  const newTotalTests = user.totalTests + 1;
  const newAvgMarks = (user.avgMarks * user.totalTests + totalMarks) / newTotalTests;

  await db.collection("users").updateOne(
    { userId },
    {
      $set: {
        avgMarks: Math.round(newAvgMarks * 100) / 100,
        totalTests: newTotalTests,
        updatedAt: new Date(),
      },
    },
  );
}
