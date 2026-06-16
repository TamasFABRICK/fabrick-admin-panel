import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { successResponse, validationErrorResponse, errorResponse, corsPreflightResponse } from "@/lib/api/response";
import { isNonEmptyString } from "@/lib/db/schema";

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

  const { token, newPassword } = (body ?? {}) as Record<string, unknown>;

  if (!isNonEmptyString(token)) {
    return validationErrorResponse("Chýba platný token");
  }

  if (!isNonEmptyString(newPassword) || (newPassword as string).length < 8) {
    return validationErrorResponse("Heslo musí mať aspoň 8 znakov");
  }

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token as string,
      resetTokenExpires: {
        gte: new Date()
      }
    }
  });

  if (!user) {
    return errorResponse("INVALID_TOKEN", "Token je neplatný alebo už vypršal.", 400);
  }

  const passwordHash = await bcrypt.hash(newPassword as string, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpires: null,
    }
  });

  return successResponse({ success: true, message: "Heslo bolo úspešne zmenené." });
}
