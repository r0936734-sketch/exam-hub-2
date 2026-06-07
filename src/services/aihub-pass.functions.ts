import { createServerFn } from "@tanstack/react-start";
import {
  hasAIHubPassBeenReceived,
  markAIHubPassReceived,
} from "@/server/aihub";
import { connectToDatabase } from "@/server/db";
import { getSessionFromToken } from "@/server/session";

const TARGET_STUDENTS = new Set(["STU018", "STU019", "STU025"]);

type TokenInput = {
  token: string;
};

async function requireTargetStudent(token: string) {
  const db = await connectToDatabase();
  const session = await getSessionFromToken(db, token);

  if (!session || session.role !== "student") {
    throw new Error("Unauthorized");
  }

  if (!TARGET_STUDENTS.has(session.user.id)) {
    throw new Error("AI Hub pass reminder is not available for this student");
  }

  return session.user;
}

export const getAIHubPassReminderStatusServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: TokenInput) => data)
  .handler(async ({ data }) => {
    const user = await requireTargetStudent(data.token);
    const passReceived = await hasAIHubPassBeenReceived(user.id);

    return {
      shouldShow: !passReceived,
      passReceived,
    };
  });

export const markAIHubPassReceivedServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: TokenInput) => data)
  .handler(async ({ data }) => {
    const user = await requireTargetStudent(data.token);
    await markAIHubPassReceived(user.id);

    return {
      ok: true,
      passReceived: true,
    };
  });
