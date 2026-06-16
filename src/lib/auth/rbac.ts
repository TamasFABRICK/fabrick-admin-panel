/**
 * FABRICK Admin Panel – RBAC (Role-Based Access Control)
 * ───────────────────────────────────────────────────────
 * Single source of truth for all role and permission definitions.
 *
 * Role hierarchy (highest → lowest privilege):
 *   super_admin  ─  full access: GET + POST + PUT + PATCH + DELETE
 *   admin        ─  full access: GET + POST + PUT + PATCH + DELETE
 *   viewer       ─  read-only:  GET only
 *
 * Protected write routes (POST / PUT / PATCH / DELETE blocked for viewer):
 *   /api/products          (collection)
 *   /api/products/[id]     (individual)
 *   /api/contacts/webhook  (collection + webhook)
 *
 * Usage in a Route Handler:
 *
 *   // Require any authenticated user (GET endpoint):
 *   const payload = await guardAuth(request);
 *
 *   // Require write privilege (POST/PUT/PATCH/DELETE endpoint):
 *   const payload = await guardAuth(request, { requireWrite: true });
 *
 *   // Require a specific role:
 *   const payload = await guardAuth(request, { roles: ["super_admin"] });
 *
 * guardAuth() always throws AuthError on failure – never returns null.
 * Catch it and call authErrorToResponse() to build the HTTP response.
 */

import { type NextRequest } from "next/server";
import { verifyToken, extractBearerToken, type JwtPayload } from "./jwt";
import {
  forbiddenResponse,
  unauthorizedResponse,
} from "@/lib/api/response";

// ─────────────────────────────────────────────────────────────
// Role definitions
// ─────────────────────────────────────────────────────────────

/** Roles that are allowed to mutate data (POST / PUT / PATCH / DELETE) */
export const WRITE_ROLES = ["super_admin", "admin"] as const;

/** Roles that are allowed to read data (GET) */
export const READ_ROLES = ["super_admin", "admin", "viewer"] as const;

export type WriterRole = (typeof WRITE_ROLES)[number];
export type ReaderRole = (typeof READ_ROLES)[number];
export type AnyRole = WriterRole | ReaderRole;

/** HTTP methods that constitute a write operation */
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ─────────────────────────────────────────────────────────────
// AuthError
// ─────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 401 | 403 = 401
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// ─────────────────────────────────────────────────────────────
// Guard options
// ─────────────────────────────────────────────────────────────

export interface GuardOptions {
  /**
   * When true, any role outside WRITE_ROLES receives a 403.
   * Evaluated after token verification.
   */
  requireWrite?: boolean;

  /**
   * Whitelist of roles allowed to call this handler.
   * Takes precedence over requireWrite if both are specified.
   */
  roles?: string[];
}

// ─────────────────────────────────────────────────────────────
// Core guard function
// ─────────────────────────────────────────────────────────────

/**
 * Verifies the Bearer token from the Authorization header and enforces
 * role-based access control.
 *
 * @throws {AuthError} 401 if no / invalid token
 * @throws {AuthError} 403 if role is insufficient
 */
export async function guardAuth(
  request: NextRequest,
  options: GuardOptions = {}
): Promise<JwtPayload> {
  // ── 1. Extract and verify token ────────────────────────────
  const authHeader = request.headers.get("authorization");
  const token = extractBearerToken(authHeader);

  if (!token) {
    throw new AuthError("Authorization header missing or malformed", 401);
  }

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";
    throw new AuthError(message, 401);
  }

  // ── 2. Role whitelist (explicit list takes priority) ───────
  if (options.roles && options.roles.length > 0) {
    if (!options.roles.includes(payload.role)) {
      throw new AuthError(
        `Role '${payload.role}' is not permitted. Required: [${options.roles.join(", ")}]`,
        403
      );
    }
    return payload;
  }

  // ── 3. Write guard (viewer → 403 on mutations) ─────────────
  if (options.requireWrite) {
    if (!(WRITE_ROLES as readonly string[]).includes(payload.role)) {
      throw new AuthError(
        `Role '${payload.role}' is read-only and cannot perform ${request.method} requests. ` +
          `Required role: ${WRITE_ROLES.join(" or ")}.`,
        403
      );
    }
  }

  return payload;
}

// ─────────────────────────────────────────────────────────────
// Response converter
// ─────────────────────────────────────────────────────────────

/**
 * Converts an AuthError (or any unknown error from guardAuth) into
 * the appropriate HTTP Response so route handlers stay concise:
 *
 *   const payload = await guardAuth(request, { requireWrite: true })
 *     .catch(authErrorToResponse);
 *   if (payload instanceof Response) return payload;
 */
export function authErrorToResponse(err: unknown): Response {
  if (err instanceof AuthError) {
    return err.statusCode === 403
      ? forbiddenResponse(err.message)
      : unauthorizedResponse(err.message);
  }
  return unauthorizedResponse("Authentication failed");
}

// ─────────────────────────────────────────────────────────────
// Convenience: silent optional auth (for public GET endpoints)
// ─────────────────────────────────────────────────────────────

/**
 * Attempts to verify the token but never throws.
 * Returns the payload if valid, null if missing / invalid.
 * Use for endpoints that have different behaviour for
 * authenticated vs. anonymous callers.
 */
export async function optionalAuth(
  request: NextRequest
): Promise<JwtPayload | null> {
  try {
    return await guardAuth(request);
  } catch {
    return null;
  }
}
