/**
 * GET    /api/users/[id]  – get single user     (super_admin only)
 * PUT    /api/users/[id]  – full update          (super_admin only)
 * PATCH  /api/users/[id]  – partial update       (super_admin only)
 * DELETE /api/users/[id]  – hard delete          (super_admin only)
 *
 * RBAC: All methods require super_admin role → viewer / admin → 403
 *
 * Business rules:
 *   • passwordHash is never returned in any response.
 *   • To change a password: include "password" in the body (min 8 chars).
 *     It will be hashed with bcrypt before storage.
 *   • To leave the password unchanged: omit "password" from the body.
 *   • DELETE is a hard delete. A super_admin cannot delete their own account
 *     (prevents accidental lockout).
 *   • Email changes are checked for uniqueness against other users.
 *
 * PUT body (all fields required except password):
 * {
 *   email:     string
 *   name:      string
 *   role:      "super_admin" | "admin" | "viewer"
 *   password?: string  (min 8 chars – omit to keep current)
 * }
 *
 * PATCH body (only include fields to update):
 * {
 *   email?:    string
 *   name?:     string
 *   role?:     "super_admin" | "admin" | "viewer"
 *   password?: string  (min 8 chars)
 * }
 */

import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { guardAuth, authErrorToResponse } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
  errorResponse,
  corsPreflightResponse,
} from "@/lib/api/response";
import {
  isNonEmptyString,
  isValidEmail,
  type UserRole,
  type UserPublic,
} from "@/lib/db/schema";

const VALID_ROLES: UserRole[] = ["super_admin", "admin", "viewer"];

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  permissions: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
};

export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

// ─────────────────────────────────────────────────────────────
// GET /api/users/[id]
// ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const payload = await guardAuth(request, { roles: ["super_admin"] }).catch(
    authErrorToResponse
  );
  if (payload instanceof Response) return payload;

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) return notFoundResponse("User");

  return successResponse({ ...user, permissions: JSON.parse(user.permissions || "[]") });
}

// ─────────────────────────────────────────────────────────────
// PUT /api/users/[id]  – full replace
// ─────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const payload = await guardAuth(request, { roles: ["super_admin"] }).catch(
    authErrorToResponse
  );
  if (payload instanceof Response) return payload;

  const { id } = await params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return notFoundResponse("User");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  const { email, name, role, password, permissions } = (body ?? {}) as Record<string, unknown>;

  // Validation
  if (!isNonEmptyString(email) || !isValidEmail(email)) {
    return validationErrorResponse("Field 'email' must be a valid email address");
  }
  if (!isNonEmptyString(name)) {
    return validationErrorResponse("Field 'name' is required");
  }
  if (!VALID_ROLES.includes(role as UserRole)) {
    return validationErrorResponse(
      `Field 'role' must be one of: ${VALID_ROLES.join(", ")}`
    );
  }
  if (password !== undefined) {
    if (!isNonEmptyString(password) || (password as string).length < 8) {
      return validationErrorResponse(
        "Field 'password' must be at least 8 characters when provided"
      );
    }
  }

  // Email uniqueness
  const normalizedEmail = (email as string).toLowerCase().trim();
  const emailConflict = await prisma.user.findFirst({
    where: { email: normalizedEmail, id: { not: id } }
  });
  if (emailConflict) {
    return errorResponse("EMAIL_CONFLICT", `Email '${normalizedEmail}' is already taken`, 409);
  }

  // Build patch
  const data: any = {
    email: normalizedEmail,
    name: String(name).trim(),
    role: role as UserRole,
  };

  if (Array.isArray(permissions)) {
    data.permissions = JSON.stringify(permissions);
  }

  if (password !== undefined) {
    data.passwordHash = await hashPassword(password as string);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: userSelect
  });
  return successResponse({ ...updated, permissions: JSON.parse(updated.permissions || "[]") });
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/users/[id]  – partial update
// ─────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const payload = await guardAuth(request, { roles: ["super_admin"] }).catch(
    authErrorToResponse
  );
  if (payload instanceof Response) return payload;

  const { id } = await params;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return notFoundResponse("User");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  const patch = (body ?? {}) as Record<string, unknown>;
  const update: any = {};

  // email
  if ("email" in patch) {
    if (!isNonEmptyString(patch.email) || !isValidEmail(patch.email as string)) {
      return validationErrorResponse("Field 'email' must be a valid email address");
    }
    const normalizedEmail = (patch.email as string).toLowerCase().trim();
    const conflict = await prisma.user.findFirst({
      where: { email: normalizedEmail, id: { not: id } }
    });
    if (conflict) {
      return errorResponse("EMAIL_CONFLICT", `Email '${normalizedEmail}' is already taken`, 409);
    }
    update.email = normalizedEmail;
  }

  // name
  if ("name" in patch) {
    if (!isNonEmptyString(patch.name)) {
      return validationErrorResponse("Field 'name' cannot be empty");
    }
    update.name = String(patch.name).trim();
  }

  // role
  if ("role" in patch) {
    if (!VALID_ROLES.includes(patch.role as UserRole)) {
      return validationErrorResponse(
        `Field 'role' must be one of: ${VALID_ROLES.join(", ")}`
      );
    }
    
    // OCHRANA PRI ÚPRAVE
    if (existing.role === "super_admin" && patch.role !== "super_admin") {
      const superAdminCount = await prisma.user.count({ where: { role: 'super_admin' } });
      if (superAdminCount <= 1) {
        return NextResponse.json({ error: 'V systéme musí zostať aspoň jeden Super Admin.' }, { status: 400 });
      }
    }

    update.role = patch.role as UserRole;
  }

  // permissions
  if ("permissions" in patch) {
    if (Array.isArray(patch.permissions)) {
      update.permissions = JSON.stringify(patch.permissions);
    }
  }

  // password
  if ("password" in patch) {
    if (!isNonEmptyString(patch.password) || (patch.password as string).length < 8) {
      return validationErrorResponse(
        "Field 'password' must be at least 8 characters when provided"
      );
    }
    update.passwordHash = await hashPassword(patch.password as string);
  }

  if (Object.keys(update).length === 0) {
    return validationErrorResponse(
      "Request body must contain at least one updatable field: email, name, role, permissions, password"
    );
  }

  const updated = await prisma.user.update({
    where: { id },
    data: update,
    select: userSelect
  });
  return successResponse({ ...updated, permissions: JSON.parse(updated.permissions || "[]") });
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/users/[id]  – hard delete
// ─────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const payload = await guardAuth(request, { roles: ["super_admin"] }).catch(
    authErrorToResponse
  );
  if (payload instanceof Response) return payload;

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return notFoundResponse("User");

  // Prevent self-deletion (lockout protection)
  if (id === payload.sub) {
    return NextResponse.json({ error: 'Nemôžete zmazať svoje vlastné konto.' }, { status: 400 });
  }

  // OCHRANA PRI MAZANÍ
  if (user.role === "super_admin") {
    const superAdminCount = await prisma.user.count({ where: { role: 'super_admin' } });
    if (superAdminCount <= 1) {
      return NextResponse.json({ error: 'V systéme musí zostať aspoň jeden Super Admin.' }, { status: 400 });
    }
  }

  await prisma.user.delete({ where: { id } });

  return successResponse({ id, deleted: true });
}
