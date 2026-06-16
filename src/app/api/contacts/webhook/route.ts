/**
 * POST /api/contacts/webhook  – ingest lead (visualizer / N8N / MCP)
 * GET  /api/contacts/webhook  – list contacts (all authenticated roles)
 *
 * RBAC matrix:
 *   GET   → viewer ✅  admin ✅  super_admin ✅  (any authenticated role)
 *           Salespeople with viewer role can see the full leads list.
 *   POST  → webhook secret  (N8N / MCP / visualizer)
 *           OR write role   (admin ✅  super_admin ✅)
 *           viewer with JWT but without webhook secret → 403
 *
 * Webhook secret logic (POST):
 *   • If X-Webhook-Secret header matches WEBHOOK_SECRET env var → allow (N8N/MCP)
 *   • Else fall back to JWT auth with write-role check
 *   • If neither passes → 403
 *
 * N8N integration:
 *   1. HTTP Request node → POST this URL
 *   2. Header X-Webhook-Secret = <WEBHOOK_SECRET env value>
 *   3. Payload shape documented in the JSDoc below
 */

import { type NextRequest } from "next/server";
import { db } from "@/lib/db/store";
import { guardAuth, optionalAuth, authErrorToResponse } from "@/lib/auth/rbac";
import {
  successResponse,
  validationErrorResponse,
  errorResponse,
  unauthorizedResponse,
  corsPreflightResponse,
  paginate,
} from "@/lib/api/response";
import { isValidEmail, isNonEmptyString, type ContactSource } from "@/lib/db/schema";
import { AuthError } from "@/lib/auth/rbac";

const VALID_SOURCES: ContactSource[] = ["visualizer", "webhook", "manual", "n8n"];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function matchesWebhookSecret(request: NextRequest): boolean {
  const envSecret = process.env.WEBHOOK_SECRET;
  if (!envSecret) return false; // No secret configured → don't grant via header
  const incoming = request.headers.get("x-webhook-secret");
  return incoming === envSecret;
}

export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

// ─────────────────────────────────────────────────────────────
// POST /api/contacts/webhook
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  // ── Auth: webhook secret OR write-role JWT ─────────────────
  const hasValidSecret = matchesWebhookSecret(request);

  if (!hasValidSecret) {
    // No secret → require a write-role JWT
    const jwtPayload = await optionalAuth(request);

    if (!jwtPayload) {
      // No token at all – check if WEBHOOK_SECRET is unconfigured (open dev mode)
      if (!process.env.WEBHOOK_SECRET) {
        // Dev mode: no secret configured → allow unauthenticated webhook ingestion
        // (matches original behaviour for the visualizer)
      } else {
        return errorResponse(
          "WEBHOOK_FORBIDDEN",
          "Provide a valid X-Webhook-Secret header or a write-role Bearer token",
          403
        );
      }
    } else {
      // Token present – enforce write-role
      try {
        await guardAuth(request, { requireWrite: true });
      } catch (err) {
        return authErrorToResponse(err);
      }
    }
  }

  // ── Parse body ─────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  const { name, email, phone, company, gdprConsent, source, combination, metadata } =
    (body ?? {}) as Record<string, unknown>;

  if (!isNonEmptyString(name)) {
    return validationErrorResponse("Field 'name' is required");
  }
  if (!isNonEmptyString(email) || !isValidEmail(String(email))) {
    return validationErrorResponse("Field 'email' must be a valid email address");
  }
  if (gdprConsent !== true) {
    return validationErrorResponse(
      "Field 'gdprConsent' must be true – GDPR consent required"
    );
  }

  // Prevent duplicate contacts (same email within 60 seconds)
  const existing = db.contacts.findAll().find(
    (c) =>
      c.email === String(email).toLowerCase().trim() &&
      Date.now() - new Date(c.createdAt).getTime() < 60_000
  );
  if (existing) {
    return successResponse(existing, 200);
  }

  const resolvedSource: ContactSource = VALID_SOURCES.includes(
    source as ContactSource
  )
    ? (source as ContactSource)
    : "webhook";

  const contact = db.contacts.create({
    name: String(name).trim(),
    email: String(email).toLowerCase().trim(),
    phone: isNonEmptyString(phone) ? String(phone).trim() : null,
    company: isNonEmptyString(company) ? String(company).trim() : null,
    source: resolvedSource,
    combination:
      combination && typeof combination === "object"
        ? {
            brickId:
              ((combination as Record<string, unknown>).brickId as string | null) ?? null,
            mortarId:
              ((combination as Record<string, unknown>).mortarId as string | null) ?? null,
            bondId:
              ((combination as Record<string, unknown>).bondId as string | null) ?? null,
          }
        : null,
    metadata:
      metadata && typeof metadata === "object"
        ? (metadata as Record<string, unknown>)
        : {},
    gdprConsent: true,
  });

  // ── Forward to N8N if configured (fire-and-forget) ─────────
  const n8nWebhookUrl = process.env.N8N_CRM_WEBHOOK_URL;
  if (n8nWebhookUrl) {
    fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact, trigger: "new_lead" }),
    }).catch((err) => {
      console.error("[N8N] Failed to forward contact:", err);
    });
  }

  return successResponse(contact, 201);
}

// ─────────────────────────────────────────────────────────────
// GET /api/contacts/webhook  – list contacts (any auth role)
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  // Any authenticated role may read the contacts list
  const payload = await guardAuth(request).catch(authErrorToResponse);
  if (payload instanceof Response) return payload;

  void payload;

  const contacts = db.contacts.findAll().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const { data, meta } = paginate(contacts, request);
  return successResponse(data, 200, meta);
}
