import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import type { Db } from "mongodb";
import { verifyToken, type TokenPayload } from "@/server/jwt";

const AUTH_COOKIE = "lt_grade_session";
const SEVEN_DAYS = 60 * 60 * 24 * 7; // Extended to 7 days for better persistence

// Cookie options that work on both localhost (HTTP) and production (HTTPS)
function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);

  return {
    httpOnly: false, // Allow JS access as fallback for browsers that block cookies
    sameSite: isProduction ? ("none" as const) : ("lax" as const), // "none" for production, "lax" for localhost
    secure: isProduction, // Only enforce secure flag in production (HTTPS)
    path: "/",
    maxAge: SEVEN_DAYS,
    domain: undefined, // Let browser handle domain automatically
  };
}

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: "student" | "admin";
};

export type SessionResult = {
  payload: TokenPayload;
  user: SessionUser;
  role: "student" | "admin";
};

export function setAuthCookie(token: string) {
  setCookie(AUTH_COOKIE, token, getCookieOptions());
}

export function clearAuthCookie() {
  deleteCookie(AUTH_COOKIE, { path: "/" });
}

export function readAuthToken(fallbackToken?: string) {
  // Prefer the HttpOnly cookie. The fallback only keeps old calls working.
  return getCookie(AUTH_COOKIE) || fallbackToken || "";
}

export async function getSessionFromToken(
  db: Db,
  token: string,
): Promise<SessionResult | null> {
  const payload = verifyToken(token);
  if (!payload) return null;

  const collection = payload.role === "admin" ? "admins" : "users";
  const user = await db.collection(collection).findOne({
    userId: payload.userId,
    role: payload.role,
  });

  if (!user || user.active === false) return null;

  return {
    payload,
    role: payload.role,
    user: {
      id: user.userId,
      username: String(user.name || user.userId).toLowerCase().replace(/\s+/g, "_"),
      name: user.name || payload.name,
      role: payload.role,
    },
  };
}

export async function requireSession(
  db: Db,
  role: "student" | "admin",
  fallbackToken?: string,
) {
  const session = await getSessionFromToken(db, readAuthToken(fallbackToken));

  if (!session || session.role !== role) {
    throw new Error(role === "admin" ? "Forbidden - Admin only" : "Forbidden - Student only");
  }

  return session;
}
