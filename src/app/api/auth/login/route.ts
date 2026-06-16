/**
 * POST /api/auth/login
 * ─────────────────────
 * Accepts { email, password } and returns a signed JWT on success.
 *
 * Password verification order:
 *   1. bcrypt.compare(password, user.passwordHash)  – production path
 *   2. DEV_PASSWORDS fallback – for accounts created before bcrypt was wired in
 *      (seeded accounts with placeholder hashes)
 *
 * N8N integration note:
 *   Use this endpoint in an N8N "HTTP Request" node to obtain a token,
 *   then pass it as `Authorization: Bearer <token>` in subsequent nodes.
 */

import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { signToken } from "@/lib/auth/jwt";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  corsPreflightResponse,
} from "@/lib/api/response";
import { isValidEmail, isNonEmptyString } from "@/lib/db/schema";

const DEV_PASSWORDS: Record<string, string> = {
  "admin@fabrick.sk": "admin123",
  "viewer@fabrick.sk": "viewer123",
};

export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  const { email, password } = (body ?? {}) as Record<string, unknown>;

  if (!isNonEmptyString(email) || !isValidEmail(email)) {
    return validationErrorResponse("Field 'email' must be a valid email address");
  }
  if (!isNonEmptyString(password)) {
    return validationErrorResponse("Field 'password' is required");
  }

  const normalizedEmail = (email as string).toLowerCase().trim();
  
  // Seed admin if DB is completely empty and someone is trying to log in as admin
  if (normalizedEmail === "admin@fabrick.sk") {
    const count = await prisma.user.count();
    if (count === 0) {
      const pwHash = await hashPassword("admin123");
      await prisma.user.create({
        data: {
          email: "admin@fabrick.sk",
          name: "FABRICK Admin",
          passwordHash: pwHash,
          role: "super_admin",
          permissions: JSON.stringify([
            "products:read", "products:write",
            "crm:read", "crm:write",
            "marketing:read", "marketing:write",
            "settings:read", "settings:write",
            "password:read", "password:write",
            "users:read", "users:write"
          ]),
        }
      });
    }
  }

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    return errorResponse("INVALID_CREDENTIALS", "Invalid email or password", 401);
  }

  let passwordMatch = await verifyPassword(password as string, user.passwordHash);

  if (!passwordMatch) {
    const devPw = DEV_PASSWORDS[normalizedEmail];
    passwordMatch = devPw !== undefined && password === devPw;
  }

  if (!passwordMatch) {
    return errorResponse("INVALID_CREDENTIALS", "Invalid email or password", 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  const parsedPermissions = JSON.parse(user.permissions || "[]");

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    permissions: parsedPermissions,
  });

  return successResponse(
    {
      token,
      expiresIn: 60 * 60 * 8,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: parsedPermissions,
      },
    },
    200
  );
}
