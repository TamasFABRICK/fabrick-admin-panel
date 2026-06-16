import { type NextRequest } from "next/server";
import { guardAuth, authErrorToResponse } from "@/lib/auth/rbac";
import {
  successResponse,
  validationErrorResponse,
  createdResponse,
  corsPreflightResponse,
} from "@/lib/api/response";
import { db }                          from "@/lib/db/store";
import { isNonEmptyString }            from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

// ─────────────────────────────────────────────────────────────
// GET /api/contacts
// Číta LOKÁLNE z db.json – žiadne externé volania Konfigurátora.
// Kontakty prichádzajú cez /api/contacts/webhook a POST nižšie.
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  // Any authenticated role can read contacts (viewer included per RBAC v2)
  const payload = await guardAuth(request).catch(authErrorToResponse);
  if (payload instanceof Response) return payload;

  // Lokálne kontakty zoradené od najnovšieho
  const contacts = db.contacts
    .findAll()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return successResponse(contacts);
}

// ─────────────────────────────────────────────────────────────
// POST /api/contacts
// Create a local-only CRM contact (e.g. manually added lead)
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  const payload = await guardAuth(request, { requireWrite: true }).catch(
    authErrorToResponse
  );
  if (payload instanceof Response) return payload;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const { name, email, phone, company, gdprConsent, combination, metadata } = raw;

  if (!isNonEmptyString(name)) {
    return validationErrorResponse("Field 'name' is required");
  }
  if (!isNonEmptyString(email)) {
    return validationErrorResponse("Field 'email' is required");
  }

  const contact = db.contacts.create({
    name:        String(name).trim(),
    email:       String(email).trim().toLowerCase(),
    phone:       isNonEmptyString(phone)   ? String(phone).trim()   : null,
    company:     isNonEmptyString(company) ? String(company).trim() : null,
    gdprConsent: typeof gdprConsent === "boolean" ? gdprConsent : false,
    source:      "manual" as import("@/lib/db/schema").ContactSource,
    combination: (combination ?? null) as {
      brickId:  string | null;
      mortarId: string | null;
      bondId:   string | null;
    } | null,
    metadata:    typeof metadata === "object" && metadata !== null
      ? (metadata as Record<string, unknown>)
      : {},
  });

  return createdResponse(contact);
}
