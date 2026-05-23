import { createServerFn } from "@tanstack/react-start/server";
import { connectToDatabase } from "@/server/db";
import { createUser } from "@/server/user";
import { verifyToken, extractTokenFromHeader } from "@/server/jwt";

export const createStudentServerFn = createServerFn().handler(
  async (input: { token: string; name: string; password: string }) => {
    try {
      if (!input.token) {
        throw new Error("Unauthorized");
      }

      const payload = verifyToken(input.token);
      if (!payload || payload.role !== "admin") {
        throw new Error("Forbidden - Admin only");
      }

      if (!input.name || !input.password) {
        throw new Error("name and password are required");
      }

      const db = await connectToDatabase();
      const user = await createUser(db, {
        name: input.name,
        password: input.password,
        role: "student",
      });

      return {
        userId: user.userId,
        name: user.name,
        role: user.role,
      };
    } catch (error) {
      throw new Error((error as Error).message || "Failed to create student");
    }
  },
);
