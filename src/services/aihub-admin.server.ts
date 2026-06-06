"use server";

import bcrypt from "bcrypt";
import { connectToDatabase } from "@/server/db";

/**
 * Admin function to enable AI Hub for a user
 * Usage: Call this once to set up AI Hub access
 */
export async function setupAIHubAccessFn(userId: string, plainPasscode: string) {
  try {
    const db = await connectToDatabase();
    const usersCollection = db.collection("aihub_users");

    // Hash the passcode using bcrypt with 12 rounds (secure)
    const hashedPasscode = await bcrypt.hash(plainPasscode, 12);

    // Enable AI Hub access
    await usersCollection.updateOne(
      { userId },
      {
        $set: {
          userId,
          aiHubEnabled: true,
          role: "premium_aihub",
          passcodeHash: hashedPasscode,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    return {
      success: true,
      message: `AI Hub enabled for ${userId}`,
    };
  } catch (error) {
    console.error("Error setting up AI Hub:", error);
    return {
      success: false,
      error: "Failed to setup AI Hub access",
    };
  }
}
