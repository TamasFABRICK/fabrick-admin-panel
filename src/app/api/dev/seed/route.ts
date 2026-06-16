/**
 * POST /api/dev/seed
 * ───────────────────
 * One-shot database reset + seed endpoint.
 * ONLY available when NODE_ENV !== "production".
 *
 * Atomically replaces the entire data/db.json with realistic
 * demo data suitable for Dashboard QA and frontend testing.
 *
 * Seeded data:
 *   • 2 users       (admin@fabrick.sk / admin123)
 *   • 5 tehly       (bricks)   – 1 intentionally has 0 views
 *   • 3 škáry       (mortars)
 *   • 3 väzby       (bonds)    – 1 intentionally has 0 views
 *   • 11 contacts   (CRM)
 *   • 25 sessions   (analytics, spread over 30 days)
 *
 * After seeding, the endpoint runs the popularity aggregator and
 * returns a verification report so you can confirm the LEFT JOIN
 * logic works before opening the Dashboard.
 *
 * Usage:
 *   curl -X POST http://localhost:3000/api/dev/seed
 *   or PowerShell:
 *   Invoke-RestMethod http://localhost:3000/api/dev/seed -Method POST
 */

import { resetAndSeed } from "@/lib/db/store";
import { buildSeedState, EXPECTED_SCORES } from "@/lib/db/seedData";
import { aggregateProductPopularity } from "@/lib/analytics/aggregator";
import {
  successResponse,
  errorResponse,
  corsPreflightResponse,
} from "@/lib/api/response";

export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

export async function POST(): Promise<Response> {
  // ── Guard: production safety ────────────────────────────────
  if (process.env.NODE_ENV === "production") {
    return errorResponse(
      "SEED_FORBIDDEN",
      "Seed endpoint is disabled in production",
      403
    );
  }

  // ── 1. Build the fresh state ─────────────────────────────────
  const freshState = buildSeedState();

  // ── 2. Atomically write to db.json ───────────────────────────
  resetAndSeed(freshState);

  // ── 3. Verify: run aggregator immediately after seeding ──────
  const popularity = aggregateProductPopularity(30);

  // Map results for verification report
  const verificationRows = popularity.products.map((row) => {
    const expected = EXPECTED_SCORES[row.name];
    const ok = expected
      ? row.sessionViews === expected.sessionViews &&
        row.combinationSaves === expected.combinationSaves
      : true;
    return {
      name: row.name,
      category: row.category,
      rank: row.rank,
      sessionViews: row.sessionViews,
      combinationSaves: row.combinationSaves,
      totalScore: row.totalScore,
      expectedScore: expected?.totalScore ?? "—",
      ok,
    };
  });

  const allPassed = verificationRows
    .filter((r) => EXPECTED_SCORES[r.name] !== undefined)
    .every((r) => r.ok);

  const zeroViewProducts = verificationRows.filter((r) => r.totalScore === 0);

  return successResponse({
    seeded: true,
    summary: {
      users: freshState.users.length,
      products: freshState.products.length,
      contacts: freshState.contacts.length,
      sessions: freshState.sessions.length,
    },
    verification: {
      allScoresMatch: allPassed,
      zeroViewProductsPresent: zeroViewProducts.length >= 2,
      zeroViewProducts: zeroViewProducts.map((z) => ({
        name: z.name,
        category: z.category,
      })),
      productRanking: verificationRows,
    },
    credentials: {
      admin: { email: "admin@fabrick.sk", password: "admin123" },
      viewer: { email: "viewer@fabrick.sk", password: "viewer123" },
    },
  });
}
