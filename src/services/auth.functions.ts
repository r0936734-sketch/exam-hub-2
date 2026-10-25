import { createServerFn } from "@tanstack/react-start";
import { connectToDatabase } from "@/server/db";
import { findAdminByUserId } from "@/server/admin";
import { findStudentByUserIdOrName } from "@/server/user";
import { generateToken } from "@/server/jwt";
import { initializeDefaultAdmin } from "@/server/init";
import {
  clearAuthCookie,
  getSessionFromToken,
  readAuthToken,
  setAuthCookie,
} from "@/server/session";

type StudentLoginInput = {
  identifier: string;
  password: string;
};

type AdminLoginInput = {
  userId: string;
  password: string;
};

function toAuthResponse(user: {
  userId: string;
  name: string;
  role: "student" | "admin";
}) {
  const token = generateToken(user.userId, user.name, user.role);
  setAuthCookie(token);

  return {
    token: token,
    user: {
      id: user.userId,
      username: user.name.toLowerCase().replace(/\s+/g, "_"),
      name: user.name,
      role: user.role,
    },
  };
}

export const loginStudentServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: StudentLoginInput) => data)
  .handler(async ({ data }) => {
    const identifier = data.identifier.trim();
    const password = data.password.trim();

    if (!identifier || !password) {
      throw new Error("Name/user ID and password are required");
    }

    await initializeDefaultAdmin();

    const db = await connectToDatabase();
    const user = await findStudentByUserIdOrName(db, identifier);

    if (!user) {
      throw new Error("Invalid name/user ID or password");
    }

    // Compare plaintext password
    if (password !== user.password) {
      throw new Error("Invalid name/user ID or password");
    }

    if (user.active === false) {
      throw new Error("Account is inactive");
    }

    return toAuthResponse(user);
  });

export const loginAdminServerFn = createServerFn({ method: "POST" })
  .inputValidator((data: AdminLoginInput) => data)
  .handler(async ({ data }) => {
    const userId = data.userId.trim().toUpperCase();
    const password = data.password.trim();

    if (!userId || !password) {
      throw new Error("Admin ID and password are required");
    }

    await initializeDefaultAdmin();

    const db = await connectToDatabase();
    const user = await findAdminByUserId(db, userId);

    if (!user || user.password !== password) {
      throw new Error("Invalid admin ID or password");
    }

    if (user.active === false) {
      throw new Error("Admin account is inactive");
    }

    return toAuthResponse(user);
  });

export const loginServerFn = loginStudentServerFn;

export const getCurrentSessionServerFn = createServerFn({ method: "POST" }).handler(async () => {
  await initializeDefaultAdmin();

  const db = await connectToDatabase();
  const session = await getSessionFromToken(db, readAuthToken());

  if (!session) {
    clearAuthCookie();
    return { user: null, role: null, token: null };
  }

  // Refresh the session cookie to extend expiration
  const token = generateToken(session.user.id, session.user.name, session.role);
  setAuthCookie(token);

  return {
    user: session.user,
    role: session.role,
    token: token, // Return the actual token for localStorage backup
  };
});

export const logoutServerFn = createServerFn({ method: "POST" }).handler(async () => {
  clearAuthCookie();
  return { ok: true };
});
