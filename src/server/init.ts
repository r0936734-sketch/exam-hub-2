import { connectToDatabase } from "./db";
import { migrateLegacyAdmins, upsertAdmin } from "./admin";

export const DEFAULT_ADMIN_ID = (process.env.ADMIN_USER_ID || "ADM001").trim().toUpperCase();
export const DEFAULT_ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "admin123").trim();
export const DEFAULT_ADMIN_NAME = (process.env.ADMIN_NAME || "Platform Admin").trim();

export async function initializeDefaultAdmin() {
  try {
    const db = await connectToDatabase();
    await db.collection("admins").createIndex({ userId: 1 }, { unique: true });

    await migrateLegacyAdmins(db);
    await db.collection("users").createIndex({ userId: 1 }, { unique: true });
    await upsertAdmin(db, {
      userId: DEFAULT_ADMIN_ID,
      name: DEFAULT_ADMIN_NAME,
      password: DEFAULT_ADMIN_PASSWORD,
      active: true,
    });
  } catch (error) {
    console.error("Failed to initialize default admin:", error);
    throw error;
  }
}
