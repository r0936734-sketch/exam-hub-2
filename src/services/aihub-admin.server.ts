"use server";

import bcrypt from "bcrypt";
import { createServerFn } from "@tanstack/react-start";
import { connectToDatabase } from "@/server/db";
import { getCurrentSessionServerFn } from "./auth.functions";
import {
  createAIHubUserSecure,
  changeAIHubPasscodeSecure,
} from "@/server/aihub";

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

/**
 * Admin: Create new AI Hub user for a student with random secure passcode
 */
export const createAIHubUserServerFn = createServerFn({
  method: "POST",
})
  .inputValidator((data: { studentUserId: string }) => data)
  .handler(async ({ data }) => {
    try {
      const session = await getCurrentSessionServerFn();
      if (session?.role !== "admin") {
        return {
          error: "Unauthorized: Admin access required",
          success: false,
        };
      }

      const { studentUserId } = data;

      const { userId, temporaryPasscode } = await createAIHubUserSecure(
        studentUserId,
        session.user.id,
      );

      return {
        success: true,
        userId,
        temporaryPasscode,
        message: `AI Hub access created. Share this passcode with the student: ${temporaryPasscode}`,
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create AI Hub user",
        success: false,
      };
    }
  });

/**
 * Student: Change their own AI Hub passcode
 */
export const changeAIHubPasscodeServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    (data: {
      oldPasscode: string;
      newPasscode: string;
      confirmPasscode: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await getCurrentSessionServerFn();
      if (!session?.user?.id) {
        return { error: "Unauthorized", success: false };
      }

      const { oldPasscode, newPasscode, confirmPasscode } = data;

      // Validate
      if (newPasscode !== confirmPasscode) {
        return {
          error: "New passcodes do not match",
          success: false,
        };
      }

      if (newPasscode.length < 6) {
        return {
          error: "Passcode must be at least 6 characters",
          success: false,
        };
      }

      await changeAIHubPasscodeSecure(
        session.user.id,
        oldPasscode,
        newPasscode,
      );

      return {
        success: true,
        message: "Passcode changed successfully",
      };
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Failed to change passcode",
        success: false,
      };
    }
  });

/**
 * Admin: View AI Hub user list with access status
 */
export const getAIHubUsersListServerFn = createServerFn({
  method: "POST",
}).handler(async () => {
  try {
    const session = await getCurrentSessionServerFn();
    if (session?.role !== "admin") {
      return { error: "Unauthorized", users: [] };
    }

    const db = await connectToDatabase();
    const aiHubUsers = await db
      .collection("aihub_users")
      .find({ aiHubEnabled: true })
      .toArray();

    // Get student details
    const userIds = aiHubUsers.map((u) => u.userId);
    const students = await db
      .collection("users")
      .find({ userId: { $in: userIds } })
      .toArray();

    const result = aiHubUsers.map((ahUser: any) => {
      const student = students.find((s: any) => s.userId === ahUser.userId);
      return {
        userId: ahUser.userId,
        studentName: student?.name || "Unknown",
        aiHubEnabled: ahUser.aiHubEnabled,
        createdAt: ahUser.createdAt,
        updatedAt: ahUser.updatedAt,
      };
    });

    return { users: result, error: null };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to fetch users",
      users: [],
    };
  }
});

/**
 * Admin: View access audit logs
 * Audit logging is disabled, so this never reads or writes Mongo audit data.
 */
export const getAIHubAuditLogsServerFn = createServerFn({
  method: "POST",
})
  .inputValidator(
    (data: {
      userId?: string;
      action?: string;
      days?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    try {
      const session = await getCurrentSessionServerFn();
      if (session?.role !== "admin") {
        return { error: "Unauthorized", logs: [] };
      }

      return { logs: [], error: null };
    } catch (error) {
      return {
        error:
          error instanceof Error ? error.message : "Failed to fetch logs",
        logs: [],
      };
    }
  });
