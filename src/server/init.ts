import { connectToDatabase } from "./db";
import { migrateLegacyAdmins } from "./admin";

export async function initializeDefaultAdmin() {
  try {
    const db = await connectToDatabase();
    await db.collection("admins").createIndex({ userId: 1 }, { unique: true });

    await migrateLegacyAdmins(db);
    await db.collection("users").createIndex({ userId: 1 }, { unique: true });
  } catch (error) {
    console.error("Failed to initialize admin records:", error);
    throw error;
  }
}
