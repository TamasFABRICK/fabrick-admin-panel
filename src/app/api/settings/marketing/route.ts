/**
 * GET  /api/settings/marketing  – Read current marketing & SEO settings
 * PUT  /api/settings/marketing  – Partial-update marketing & SEO settings
 *
 * RBAC: Both methods require write-role (admin | super_admin).
 *       viewer receives 403 Forbidden.
 *
 * PUT semantics:
 *   - Partial merge: only keys present in the request body are updated.
 *   - Caller never needs to send all 7 fields at once.
 *   - Empty patch {} → 422 Validation Error.
 *   - audit fields (updatedAt, updatedBy) are always written by the server;
 *     any client-supplied values for these are silently ignored.
 *
 * Limits:
 *   - customHeadScripts:  max 10 000 characters
 *   - seoTitle:           max 200 characters
 *   - seoDescription:     max 500 characters
 */

import { type NextRequest }         from "next/server";
import { db }                       from "@/lib/db/store";
import { isNonEmptyString }         from "@/lib/db/schema";
import type { MarketingSettings }   from "@/lib/db/schema";
import { guardAuth, authErrorToResponse } from "@/lib/auth/rbac";
import {
  successResponse,
  validationErrorResponse,
  corsPreflightResponse,
} from "@/lib/api/response";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────
// Field length limits (enforced on PUT)
// ─────────────────────────────────────────────────────────────

const LIMITS = {
  customHeadScripts: 10_000,
  seoTitle:          200,
  seoDescription:    500,
} as const;

// ─────────────────────────────────────────────────────────────
// CORS pre-flight
// ─────────────────────────────────────────────────────────────

export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

// ─────────────────────────────────────────────────────────────
// GET /api/settings/marketing
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await guardAuth(request, { requireWrite: true }).catch(
    authErrorToResponse
  );
  if (auth instanceof Response) return auth;

  const settings = db.marketingSettings.get();
  return successResponse(settings);
}

// ─────────────────────────────────────────────────────────────
// PUT /api/settings/marketing
// ─────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest): Promise<Response> {
  const auth = await guardAuth(request, { requireWrite: true }).catch(
    authErrorToResponse
  );
  if (auth instanceof Response) return auth;

  // ── Parse body ────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  const raw = (body ?? {}) as Record<string, unknown>;

  // ── Require at least one tracking / SEO field ─────────────
  const ALLOWED_FIELDS: Array<keyof MarketingSettings> = [
    "gtmId",
    "ga4Id",
    "googleAdsId",
    "metaPixelId",
    "customHeadScripts",
    "seoTitle",
    "seoDescription",
  ];

  const provided = ALLOWED_FIELDS.filter((f) => f in raw);
  if (provided.length === 0) {
    return validationErrorResponse(
      `At least one settable field must be provided: ${ALLOWED_FIELDS.join(", ")}`
    );
  }

  // ── Validate each provided field ──────────────────────────
  const patch: Partial<MarketingSettings> = {};

  for (const field of provided) {
    const val = raw[field];

    // All 7 tracking/SEO fields accept: non-empty string OR null (to clear)
    if (val !== null && !isNonEmptyString(val)) {
      return validationErrorResponse(
        `Field '${field}' must be a non-empty string or null`
      );
    }

    // Length limits for large text fields
    if (
      val !== null &&
      field in LIMITS &&
      (val as string).length > LIMITS[field as keyof typeof LIMITS]
    ) {
      return validationErrorResponse(
        `Field '${field}' exceeds maximum length of ${LIMITS[field as keyof typeof LIMITS]} characters`
      );
    }

    // Safe to cast: val is string | null, field is keyof MarketingSettings
    (patch as Record<string, unknown>)[field] = val ?? null;
  }

  // ── Always inject audit fields (ignore any client-supplied values) ─
  patch.updatedAt = new Date().toISOString();
  patch.updatedBy = auth.sub;

  // ── Persist & respond ─────────────────────────────────────
  const updated = db.marketingSettings.set(patch);
  return successResponse(updated);
}
