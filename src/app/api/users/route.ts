/**
 * GET  /api/users   – list all users           (super_admin only)
 * POST /api/users   – create a new user        (super_admin only)
 *
 * RBAC matrix:
 *   All methods → super_admin role required → viewer / admin → 403
 *
 * Security notes:
 *   • passwordHash is NEVER returned in any response.
 *   • Email uniqueness is enforced before creation.
 *   • Password is hashed with bcrypt (12 rounds) before storage.
 *
 * Request body for POST:
 * {
 *   email:    string   (required, valid email, unique)
 *   password: string   (required, min 8 chars)
 *   name:     string   (required)
 *   role:     "super_admin" | "admin" | "viewer"  (required)
 * }
 *
 * N8N / MCP integration:
 *   Use this endpoint to programmatically provision new admin accounts
 *   from an onboarding workflow. Always include a super_admin Bearer token.
 */

import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { guardAuth, authErrorToResponse } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import {
  successResponse,
  validationErrorResponse,
  errorResponse,
  corsPreflightResponse,
  paginate,
} from "@/lib/api/response";
import {
  isNonEmptyString,
  isValidEmail,
  type UserRole,
  type UserPublic,
} from "@/lib/db/schema";

const VALID_ROLES: UserRole[] = ["super_admin", "admin", "viewer"];

export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

// ─────────────────────────────────────────────────────────────
// GET /api/users  – list all users (super_admin only)
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  const payload = await guardAuth(request, { roles: ["super_admin"] }).catch(
    authErrorToResponse
  );
  if (payload instanceof Response) return payload;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      permissions: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
    }
  });

  const { data, meta } = paginate(users, request);
  return successResponse(data, 200, meta);
}

// ─────────────────────────────────────────────────────────────
// POST /api/users  – create user (super_admin only)
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  const payload = await guardAuth(request, { roles: ["super_admin"] }).catch(
    authErrorToResponse
  );
  if (payload instanceof Response) return payload;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  const { email, password, name, role } = (body ?? {}) as Record<string, unknown>;

  // ── Validation ──────────────────────────────────────────────
  if (!isNonEmptyString(email) || !isValidEmail(email)) {
    return validationErrorResponse("Field 'email' must be a valid email address");
  }
  if (!isNonEmptyString(password) || (password as string).length < 8) {
    return validationErrorResponse(
      "Field 'password' is required and must be at least 8 characters"
    );
  }
  if (!isNonEmptyString(name)) {
    return validationErrorResponse("Field 'name' is required");
  }
  if (!VALID_ROLES.includes(role as UserRole)) {
    return validationErrorResponse(
      `Field 'role' must be one of: ${VALID_ROLES.join(", ")}`
    );
  }

  // ── Uniqueness check ────────────────────────────────────────
  const normalizedEmail = (email as string).toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return errorResponse(
      "EMAIL_CONFLICT",
      `A user with email '${normalizedEmail}' already exists`,
      409
    );
  }

  // ── Hash password & persist ─────────────────────────────────
  const passwordHash = await hashPassword(password as string);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      name: String(name).trim(),
      role: role as UserRole,
      lastLoginAt: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      permissions: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
    }
  });

  return successResponse(user, 201);
}
