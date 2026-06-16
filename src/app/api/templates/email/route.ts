import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { guardAuth, authErrorToResponse } from "@/lib/auth/rbac";
import {
  successResponse,
  validationErrorResponse,
  errorResponse,
  forbiddenResponse,
} from "@/lib/api/response";

// GET /api/templates/email
export async function GET(request: NextRequest): Promise<Response> {
  const payload = await guardAuth(request).catch(authErrorToResponse);
  if (payload instanceof Response) return payload;

  if (
    payload.role !== "super_admin" &&
    !payload.permissions.includes("email:read") &&
    !payload.permissions.includes("email:write")
  ) {
    return forbiddenResponse("Nedostatočné oprávnenia pre prístup k e-mailovým šablónam.");
  }

  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { createdAt: "asc" }
    });
    return successResponse(templates);
  } catch (error) {
    console.error("[EmailTemplates GET]", error);
    return errorResponse("DB_ERROR", "Nepodarilo sa načítať šablóny", 500);
  }
}

// PUT /api/templates/email
export async function PUT(request: NextRequest): Promise<Response> {
  const payload = await guardAuth(request).catch(authErrorToResponse);
  if (payload instanceof Response) return payload;

  if (
    payload.role !== "super_admin" &&
    !payload.permissions.includes("email:write")
  ) {
    return forbiddenResponse("Nedostatočné oprávnenia na úpravu e-mailových šablón.");
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  const { id, subject, bodyHtml } = body;

  if (!id || typeof subject !== 'string' || typeof bodyHtml !== 'string') {
    return validationErrorResponse("Chýbajú povinné polia (id, subject, bodyHtml)");
  }

  try {
    const updated = await prisma.emailTemplate.update({
      where: { id },
      data: { subject, bodyHtml }
    });

    return successResponse(updated);
  } catch (error) {
    console.error("[EmailTemplates PUT]", error);
    return errorResponse("DB_ERROR", "Nepodarilo sa aktualizovať šablónu", 500);
  }
}
