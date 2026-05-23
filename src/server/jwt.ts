import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key_change_in_production";

// Simple JWT implementation (for production, use a proper JWT library like jsonwebtoken)
// This is a lightweight implementation suitable for Vercel free tier

function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64UrlDecode(data: string): string {
  let padded = data.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  if (remainder) {
    padded += "=".repeat(4 - remainder);
  }
  return Buffer.from(padded, "base64").toString();
}

export interface TokenPayload {
  userId: string;
  name: string;
  role: "student" | "admin";
  iat: number;
  exp: number;
}

export function generateToken(userId: string, name: string, role: "student" | "admin"): string {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 24 * 60 * 60; // 24 hours

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));

  const payload: TokenPayload = {
    userId,
    name,
    role,
    iat: now,
    exp: now + expiresIn,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Create signature
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${encodedPayload}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${header}.${encodedPayload}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const [header, payload, signature] = token.split(".");

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    if (signature !== expectedSignature) {
      return null;
    }

    // Decode and verify expiration
    const decodedPayload = JSON.parse(base64UrlDecode(payload)) as TokenPayload;

    const now = Math.floor(Date.now() / 1000);
    if (decodedPayload.exp < now) {
      return null;
    }

    return decodedPayload;
  } catch {
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}
