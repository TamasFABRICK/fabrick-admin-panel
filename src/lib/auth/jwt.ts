/**
 * FABRICK Admin Panel – JWT Helper
 * ─────────────────────────────────
 * Lightweight HMAC-SHA256 JWT implementation using Node.js crypto only.
 * No external dependencies required (jose / jsonwebtoken not installed).
 *
 * Token format: standard JWT (header.payload.signature)
 * Algorithm:    HS256
 * Secret:       JWT_SECRET env variable (falls back to dev default)
 */

import { createHmac } from "node:crypto";

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const SECRET =
  process.env.JWT_SECRET ??
  "fabrick-dev-secret-change-in-production-minimum-32-chars!!";

export const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
}

// ─────────────────────────────────────────────────────────────
// Encoding helpers
// ─────────────────────────────────────────────────────────────

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  const padded = input + "==".slice((input.length + 2) & 3);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function sign(data: string): string {
  return createHmac("sha256", SECRET)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export function signToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncode(
    JSON.stringify({ ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS })
  );
  const signature = sign(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token structure");
  }
  const [header, body, signature] = parts;
  const expected = sign(`${header}.${body}`);
  if (expected !== signature) {
    throw new Error("Invalid token signature");
  }
  const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload;
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error("Token expired");
  }
  return payload;
}

/** Extract Bearer token from Authorization header */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
