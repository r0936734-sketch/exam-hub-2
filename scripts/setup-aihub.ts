/**
 * One-time setup script to enable AI Hub for users
 * Run with: npx tsx scripts/setup-aihub.ts
 */

import "dotenv/config";
import bcrypt from "bcrypt";
import { connectToDatabase } from "../src/server/db";

async function main() {
  try {
    const passcode = process.env.AIHUB_PASSCODE;
    
    if (!passcode) {
      console.error("✗ AIHUB_PASSCODE not found in .env file");
      process.exit(1);
    }

    console.log("Setting up AI Hub access for STU001...");
    
    const db = await connectToDatabase();
    const usersCollection = db.collection("aihub_users");

    // Hash the passcode
    const hashedPasscode = await bcrypt.hash(passcode, 12);

    // Enable AI Hub access
    const result = await usersCollection.updateOne(
      { userId: "STU001" },
      {
        $set: {
          userId: "STU001",
          aiHubEnabled: true,
          role: "premium_aihub",
          passcodeHash: hashedPasscode,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    console.log("✓ AI Hub enabled for STU001");
    console.log("✓ Passcode hashed securely with bcrypt");
    console.log("✓ STU001 can now access AI Hub");
    
    process.exit(0);
  } catch (error) {
    console.error("✗ Setup failed:", error);
    process.exit(1);
  }
}

main();
