import { Db } from "mongodb";

export async function generateNextUserId(db: Db, role: "student" | "admin"): Promise<string> {
  const prefix = role === "admin" ? "ADM" : "STU";

  // Get the count of users with this role
  const count = await db.collection("users").countDocuments({ role });

  // Generate sequential ID with padding (e.g., STU001, STU002)
  const newNumber = count + 1;
  const userId = `${prefix}${String(newNumber).padStart(3, "0")}`;

  return userId;
}

export async function getNextSequentialId(db: Db): Promise<string> {
  const result = await db
    .collection("users")
    .findOne({ role: "student" }, { sort: { createdAt: -1 } });

  let nextNum = 1;
  if (result?.userId?.startsWith("STU")) {
    const currentNum = parseInt(result.userId.slice(3), 10);
    nextNum = currentNum + 1;
  }

  return `STU${String(nextNum).padStart(3, "0")}`;
}

export interface User {
  _id?: string;
  userId: string;
  name: string;
  password: string;
  role: "student" | "admin";
  avgMarks: number;
  totalTests: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function createUser(
  db: Db,
  data: { name: string; password: string; role: "student" | "admin" },
): Promise<User> {
  const userId = await generateNextUserId(db, data.role);

  const user: User = {
    userId,
    name: data.name,
    password: data.password, // Note: In production, hash this with bcrypt
    role: data.role,
    avgMarks: 0,
    totalTests: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.collection("users").insertOne(user);
  return user;
}

export async function findUserByUserId(db: Db, userId: string): Promise<User | null> {
  return db.collection("users").findOne({ userId });
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
    .find({ role: "student" })
    .sort({ avgMarks: -1 })
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
