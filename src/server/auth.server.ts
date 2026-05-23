import { createServerFn } from "@tanstack/react-start/server";
import { connectToDatabase } from "@/server/db";
import { findUserByUserId } from "@/server/user";
import { generateToken } from "@/server/jwt";

export const loginServerFn = createServerFn().handler(
  async (input: { userId: string; password: string }) => {
    try {
      if (!input.userId || !input.password) {
        throw new Error("userId and password are required");
      }

      const db = await connectToDatabase();
      const user = await findUserByUserId(db, input.userId);

      if (!user || user.password !== input.password) {
        throw new Error("Invalid credentials");
      }

      const token = generateToken(user.userId, user.name, user.role);

      return {
        token,
        user: {
          id: user.userId,
          username: user.name.toLowerCase().replace(/\s+/g, "_"),
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      throw new Error((error as Error).message || "Login failed");
    }
  },
);
