/**
 * GET  /api/public/settings  – Public read-only marketing & SEO settings
 *
 * This endpoint is intentionally unauthenticated. It is designed to be
 * consumed by the external Configurator frontend to inject tracking codes
 * and SEO metadata without requiring an Admin Panel session.
 *
 * Security guarantees:
 *   ✓ Returns ONLY the 7 public tracking/SEO fields
 *   ✗ NEVER exposes: updatedAt, updatedBy, or any other audit metadata
 *   ✗ NEVER exposes: user data, tokens, product data, or internal state
 *
 * Caching:
 *   Cache-Control: public, max-age=300, stale-while-revalidate=600
 *   → CDN can serve this for up to 5 minutes without hitting the origin.
 *   → Stale data is served for up to 10 additional minutes while revalidating.
 *   → Negligible freshness risk: tracking IDs don't change frequently.
 *
 * CORS:
 *   Allows any origin (*) so the Configurator (on a different domain) can
 *   fetch without proxy. Override via CORS_ORIGIN env var for stricter setups.
 */

import { db }                   from "@/lib/db/store";
import { corsPreflightResponse } from "@/lib/api/response";
import type { MarketingSettings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────
// Public payload type (subset of MarketingSettings)
// Audit fields are deliberately excluded.
// ─────────────────────────────────────────────────────────────

type PublicSettings = Pick<
  MarketingSettings,
  | "gtmId"
  | "ga4Id"
  | "googleAdsId"
  | "metaPixelId"
  | "customHeadScripts"
  | "seoTitle"
  | "seoDescription"
>;

const PUBLIC_FIELDS: Array<keyof PublicSettings> = [
  "gtmId",
  "ga4Id",
  "googleAdsId",
  "metaPixelId",
  "customHeadScripts",
  "seoTitle",
  "seoDescription",
];

// ─────────────────────────────────────────────────────────────
// Cache + CORS headers
// ─────────────────────────────────────────────────────────────

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

function buildHeaders(): HeadersInit {
  return {
    "Content-Type":  "application/json",
    "Access-Control-Allow-Origin":  CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    // 5-minute CDN cache; serve stale while revalidating for up to 10 more minutes
    "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
  };
}

// ─────────────────────────────────────────────────────────────
// CORS pre-flight
// ─────────────────────────────────────────────────────────────

export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

// ─────────────────────────────────────────────────────────────
// GET /api/public/settings
// ─────────────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  const full = db.marketingSettings.get();

  // Explicitly build the public payload to prevent accidental field leakage
  const publicData: PublicSettings = {} as PublicSettings;
  for (const field of PUBLIC_FIELDS) {
    (publicData as Record<string, unknown>)[field] = full[field] ?? null;
  }

  const payload = JSON.stringify({ success: true, data: publicData });

  return new Response(payload, {
    status:  200,
    headers: buildHeaders(),
  });
}
