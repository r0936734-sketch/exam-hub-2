import { createServerFn } from "@tanstack/react-start";
import { connectToDatabase } from "@/server/db";
import { getStudentProfileByUserId } from "@/server/user";
import { requireSession } from "@/server/session";

export const getStudentProfileServerFn = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const db = await connectToDatabase();
    const { payload } = await requireSession(db, "student", data.token);
    const profile = await getStudentProfileByUserId(db, payload.userId);

    if (!profile) {
      throw new Error("Student not found");
    }

    return { profile };
  });
