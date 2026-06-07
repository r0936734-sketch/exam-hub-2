export {
  loginAdminServerFn,
  loginServerFn,
  loginStudentServerFn,
} from "@/services/auth.functions";

import { connectToDatabase } from "@/server/db";
import { getSessionFromToken, readAuthToken } from "@/server/session";

export async function getUserFromServerContext(_serverContext?: unknown) {
  const db = await connectToDatabase();
  const session = await getSessionFromToken(db, readAuthToken());
  return session?.user ?? null;
}
