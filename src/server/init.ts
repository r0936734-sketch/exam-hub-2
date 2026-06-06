import { connectToDatabase } from "./db";
import { migrateLegacyAdmins } from "./admin";
import { initializeSyllabus } from "./seed-computer-syllabus";

export async function initializeDefaultAdmin() {
  try {
    const db = await connectToDatabase();
    await db.collection("admins").createIndex({ userId: 1 }, { unique: true });

    await migrateLegacyAdmins(db);
    await db.collection("users").createIndex({ userId: 1 }, { unique: true });

    // Initialize global syllabi
    await initializeSyllabus();
  } catch (error) {
    console.error("[Initialization] Failed to initialize:", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}
