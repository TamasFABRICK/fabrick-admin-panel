/**
 * FABRICK Admin Panel – Analytics Aggregator
 * ─────────────────────────────────────────
 * Shared computation layer for product popularity and session metrics.
 *
 * SQL equivalent modelled here:
 *
 *   SELECT
 *     p.id, p.name, p.category, p.image_url, p.tags, p.status,
 *     COUNT(DISTINCT sp.session_id)  AS session_views,
 *     COUNT(DISTINCT cc.contact_id)  AS combination_saves,
 *     COUNT(DISTINCT sp.session_id) + COUNT(DISTINCT cc.contact_id) AS total_score
 *   FROM products p
 *   LEFT JOIN session_products sp ON sp.product_id = p.id
 *                                 AND sp.session_started_at >= :from
 *   LEFT JOIN contact_combinations cc ON (
 *     cc.brick_id   = p.id OR
 *     cc.mortar_id  = p.id OR
 *     cc.bond_id    = p.id
 *   )
 *   WHERE p.status = 'active'
 *   GROUP BY p.id
 *   ORDER BY total_score DESC, p.name ASC;
 *
 * Key invariant: Every active product appears in the result, even with
 * session_views = 0 and combination_saves = 0 (LEFT JOIN semantics).
 * Products of ALL categories (tehla, vazba, skara, other) are included.
 */

import { db } from "@/lib/db/store";
import type { Product, ProductCategory } from "@/lib/db/schema";

// ─────────────────────────────────────────────────────────────
// Output type
// ─────────────────────────────────────────────────────────────

export interface ProductPopularityRow {
  id: string;
  name: string;
  category: ProductCategory;
  imageUrl: string | null;
  tags: string[];
  /** Views from AnalyticsSession.viewedProducts within the time window */
  sessionViews: number;
  /** Times this product appeared in a saved Contact combination (all-time) */
  combinationSaves: number;
  /**
   * Composite score = sessionViews + combinationSaves.
   * Weights are equal for now; adjust multipliers here when needed.
   */
  totalScore: number;
  /** Rank position (1-based, ties share a rank) */
  rank: number;
}

export interface PopularityResult {
  products: ProductPopularityRow[];
  period: {
    from: string;
    to: string;
    days: number;
  };
  categoryBreakdown: Record<ProductCategory, { count: number; totalScore: number }>;
}

// ─────────────────────────────────────────────────────────────
// Core aggregation (LEFT JOIN equivalent)
// ─────────────────────────────────────────────────────────────

export function aggregateProductPopularity(days: number): PopularityResult {
  const toDate = new Date();
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);

  // ── 1. Load raw tables ──────────────────────────────────────
  const allProducts = db.products.findAll();
  const allSessions = db.sessions.findAll();
  const allContacts = db.contacts.findAll();

  // ── 2. Build sessionViews map (time-windowed)  ──────────────
  // Equivalent of the LEFT JOIN with the session_products bridge table
  // filtered by session start date.
  const sessionViewCounts: Record<string, number> = {};

  for (const session of allSessions) {
    // Only count sessions within the requested time window
    if (new Date(session.startedAt) < fromDate) continue;

    for (const productId of session.viewedProducts) {
      sessionViewCounts[productId] = (sessionViewCounts[productId] ?? 0) + 1;
    }
  }

  // ── 3. Build combinationSaves map (all-time, not windowed)  ─
  // Contact combinations represent confirmed interest, so we count
  // them across all time (no date filter) to preserve historical signal.
  const combinationSaveCounts: Record<string, number> = {};

  for (const contact of allContacts) {
    if (!contact.combination) continue;

    const { brickId, mortarId, bondId } = contact.combination;
    // Each slot maps to its respective product – covers tehla, skara, AND vazba
    for (const pid of [brickId, mortarId, bondId]) {
      if (pid) {
        combinationSaveCounts[pid] = (combinationSaveCounts[pid] ?? 0) + 1;
      }
    }
  }

  // ── 4. LEFT JOIN: map every active product to its counts ────
  // Products with no sessions or combinations get score = 0 (not excluded).
  const activeProducts: Product[] = allProducts.filter(
    (p) => p.status === "active"
  );

  const rows: Omit<ProductPopularityRow, "rank">[] = activeProducts.map((p) => {
    const sessionViews = sessionViewCounts[p.id] ?? 0;
    const combinationSaves = combinationSaveCounts[p.id] ?? 0;
    const totalScore = sessionViews + combinationSaves;

    return {
      id: p.id,
      name: p.name,
      category: p.category,
      imageUrl: p.imageUrl,
      tags: p.tags,
      sessionViews,
      combinationSaves,
      totalScore,
    };
  });

  // ── 5. Sort: primary = totalScore DESC, secondary = name ASC ─
  rows.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.name.localeCompare(b.name, "sk");
  });

  // ── 6. Assign dense ranks (ties share a rank) ───────────────
  const ranked: ProductPopularityRow[] = [];
  let currentRank = 1;
  let prevScore: number | null = null;
  let rankCounter = 0;

  for (const row of rows) {
    rankCounter++;
    if (prevScore === null || row.totalScore !== prevScore) {
      currentRank = rankCounter;
    }
    ranked.push({ ...row, rank: currentRank });
    prevScore = row.totalScore;
  }

  // ── 7. Category breakdown ───────────────────────────────────
  const allCategories: ProductCategory[] = ["tehla", "vazba", "skara", "other"];
  const categoryBreakdown = Object.fromEntries(
    allCategories.map((cat) => {
      const inCat = ranked.filter((r) => r.category === cat);
      return [
        cat,
        {
          count: inCat.length,
          totalScore: inCat.reduce((sum, r) => sum + r.totalScore, 0),
        },
      ];
    })
  ) as Record<ProductCategory, { count: number; totalScore: number }>;

  return {
    products: ranked,
    period: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      days,
    },
    categoryBreakdown,
  };
}
