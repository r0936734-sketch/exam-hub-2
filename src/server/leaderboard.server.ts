import { createServerFn } from "@tanstack/react-start/server";
import { connectToDatabase } from "@/server/db";
import { getLeaderboard } from "@/server/user";

export const getLeaderboardServerFn = createServerFn().handler(async () => {
  try {
    const db = await connectToDatabase();
    const leaderboard = await getLeaderboard(db, 100);

    return { leaderboard };
  } catch (error) {
    throw new Error((error as Error).message || "Failed to fetch leaderboard");
  }
});
