import { connectToDatabase } from "./db";
import { findUserByUserId, createUser } from "./user";

export async function initializeDefaultAdmin() {
  try {
    const db = await connectToDatabase();

    // Check if default admin exists
    const adminExists = await findUserByUserId(db, "ADM001");

    if (!adminExists) {
      // Create default admin for testing
      await createUser(db, {
        name: "Platform Admin",
        password: "admin123",
        role: "admin",
      });
      console.log("✓ Default admin created: ADM001 / admin123");
    }
  } catch (error) {
    console.error("Failed to initialize default admin:", error);
  }
}
