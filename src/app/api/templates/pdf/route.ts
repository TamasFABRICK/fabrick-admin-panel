export const dynamic = 'force-dynamic';

import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { guardAuth, authErrorToResponse } from "@/lib/auth/rbac";
import {
  successResponse,
  createdResponse,
  validationErrorResponse,
  errorResponse,
  forbiddenResponse,
  corsPreflightResponse,
} from "@/lib/api/response";

// OPTIONS /api/templates/pdf
export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

// GET /api/templates/pdf
export async function GET(request: NextRequest): Promise<Response> {
  const payload = await guardAuth(request).catch(authErrorToResponse);
  if (payload instanceof Response) return payload;

  if (
    payload.role !== "super_admin" &&
    !payload.permissions.includes("email:read") &&
    !payload.permissions.includes("email:write")
  ) {
    return forbiddenResponse("Nedostatočné oprávnenia pre prístup k PDF šablónam.");
  }

  try {
    const templates = await prisma.pdfTemplate.findMany({
      orderBy: { createdAt: "asc" },
    });
    return successResponse(templates);
  } catch (error) {
    console.error("[PdfTemplates GET]", error);
    return errorResponse("DB_ERROR", "Nepodarilo sa načítať PDF šablóny", 500);
  }
}

// POST /api/templates/pdf  – vytvorenie novej šablóny
export async function POST(request: NextRequest): Promise<Response> {
  const payload = await guardAuth(request, { requireWrite: true }).catch(authErrorToResponse);
  if (payload instanceof Response) return payload;

  if (
    payload.role !== "super_admin" &&
    !payload.permissions.includes("email:write")
  ) {
    return forbiddenResponse("Nedostatočné oprávnenia na vytvorenie PDF šablóny.");
  }

  let body: { code?: string; name?: string; bodyHtml?: string; cssStyles?: string };
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  const { code, name, bodyHtml, cssStyles } = body;

  if (!code || !name || typeof bodyHtml !== "string") {
    return validationErrorResponse("Chýbajú povinné polia (code, name, bodyHtml)");
  }

  try {
    const created = await prisma.pdfTemplate.create({
      data: { code, name, bodyHtml, cssStyles: cssStyles ?? null },
    });
    return createdResponse(created);
  } catch (error: unknown) {
    console.error("[PdfTemplates POST]", error);
    const msg = String(error);
    if (msg.includes("Unique constraint")) {
      return errorResponse("CONFLICT", `Šablóna s kódom '${code}' už existuje.`, 409);
    }
    return errorResponse("DB_ERROR", "Nepodarilo sa vytvoriť PDF šablónu", 500);
  }
}

// PUT /api/templates/pdf  – aktualizácia existujúcej šablóny
export async function PUT(request: NextRequest): Promise<Response> {
  const payload = await guardAuth(request, { requireWrite: true }).catch(authErrorToResponse);
  if (payload instanceof Response) return payload;

  if (
    payload.role !== "super_admin" &&
    !payload.permissions.includes("email:write")
  ) {
    return forbiddenResponse("Nedostatočné oprávnenia na úpravu PDF šablóny.");
  }

  let body: { id?: string; name?: string; bodyHtml?: string; cssStyles?: string };
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  const { id, name, bodyHtml, cssStyles } = body;

  if (!id || typeof bodyHtml !== "string") {
    return validationErrorResponse("Chýbajú povinné polia (id, bodyHtml)");
  }

  try {
    const updated = await prisma.pdfTemplate.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        bodyHtml,
        cssStyles: cssStyles !== undefined ? cssStyles : undefined,
      },
    });
    return successResponse(updated);
  } catch (error) {
    console.error("[PdfTemplates PUT]", error);
    return errorResponse("DB_ERROR", "Nepodarilo sa aktualizovať PDF šablónu", 500);
  }
}
