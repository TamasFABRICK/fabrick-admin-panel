/**
 * FABRICK Configurator Integration – Analytics Aggregator
 * ─────────────────────────────────────────────────────────
 * Extends the existing local aggregator with data pulled from the
 * Configurator API (or its analytics endpoint if available).
 *
 * Data strategy (approved by Mission Control):
 *   - Session and product-view analytics are pulled from the Configurator
 *     (it is the user-facing system generating the events).
 *   - CRM contacts/combination saves come from the merged contact repository.
 *   - Results are merged with local db.sessions for any Admin-Panel-recorded events.
 *
 * If the Configurator does not expose /analytics/* endpoints,
 * this aggregator gracefully falls back to local-only data.
 */

import { configuratorFetch, ConfiguratorApiError } from "../configurator/client";
import { db }                                        from "@/lib/db/store";

// ─────────────────────────────────────────────────────────────
// Response types for Configurator analytics endpoints
// ─────────────────────────────────────────────────────────────

export interface ConfiguratorSessionStats {
  totalSessions:     number;
  averageDurationSec: number;
  abandonmentRate:   number; // 0-1 fraction
  period: {
    from: string;
    to:   string;
    days: number;
  };
}

export interface ConfiguratorPopularProduct {
  productId:        string;
  productName:      string;
  category:         string;
  sessionViews:     number;
  combinationSaves: number;
  totalScore:       number;
}

export interface ConfiguratorAnalyticsSummary {
  sessionStats:    ConfiguratorSessionStats;
  popularProducts: ConfiguratorPopularProduct[];
}

// ─────────────────────────────────────────────────────────────
// Merged analytics output types
// ─────────────────────────────────────────────────────────────

export interface MergedSessionStats {
  totalSessions:      number;
  averageDurationSec: number;
  abandonmentRate:    number;
  localSessions:      number;
  remoteSessions:     number;
  period: {
    from: string;
    to:   string;
    days: number;
  };
}

export interface MergedPopularProduct {
  id:               string;
  name:             string;
  category:         string;
  sessionViews:     number;
  combinationSaves: number;
  totalScore:       number;
  rank:             number;
  source:           "configurator" | "local" | "merged";
}

// ─────────────────────────────────────────────────────────────
// Local fallback computation
// ─────────────────────────────────────────────────────────────

function computeLocalSessionStats(days: number): ConfiguratorSessionStats {
  const toDate   = new Date();
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1_000);
  const fromISO  = fromDate.toISOString();
  const toISO    = toDate.toISOString();

  const sessions = db.sessions
    .findAll()
    .filter((s) => s.startedAt >= fromISO);

  const total = sessions.length;
  const completed = sessions.filter((s) => s.endedAt !== null);

  const avgDuration =
    completed.length > 0
      ? completed.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0) /
        completed.length
      : 0;

  const abandoned = sessions.filter((s) => s.abandoned).length;
  const abandonRate = total > 0 ? abandoned / total : 0;

  return {
    totalSessions:      total,
    averageDurationSec: Math.round(avgDuration),
    abandonmentRate:    parseFloat(abandonRate.toFixed(4)),
    period: { from: fromISO, to: toISO, days },
  };
}

function computeLocalPopularProducts(days: number): ConfiguratorPopularProduct[] {
  const toDate   = new Date();
  const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1_000);

  const sessions  = db.sessions.findAll().filter(
    (s) => new Date(s.startedAt) >= fromDate
  );
  const contacts  = db.contacts.findAll();
  const products  = db.products.findAll().filter((p) => p.status === "active");

  const viewCounts: Record<string, number> = {};
  for (const s of sessions) {
    for (const pid of s.viewedProducts) {
      viewCounts[pid] = (viewCounts[pid] ?? 0) + 1;
    }
  }

  const saveCounts: Record<string, number> = {};
  for (const c of contacts) {
    if (!c.combination) continue;
    for (const pid of [
      c.combination.brickId,
      c.combination.mortarId,
      c.combination.bondId,
    ]) {
      if (pid) saveCounts[pid] = (saveCounts[pid] ?? 0) + 1;
    }
  }

  return products.map((p) => ({
    productId:        p.id,
    productName:      p.name,
    category:         p.category,
    sessionViews:     viewCounts[p.id]  ?? 0,
    combinationSaves: saveCounts[p.id]  ?? 0,
    totalScore:       (viewCounts[p.id] ?? 0) + (saveCounts[p.id] ?? 0),
  }));
}

// ─────────────────────────────────────────────────────────────
// Main export: fetchConfiguratorAnalytics
// ─────────────────────────────────────────────────────────────

/**
 * Fetches analytics from the Configurator and merges with local data.
 *
 * If the Configurator analytics endpoint is unavailable, falls back
 * entirely to local db.sessions computation.
 *
 * @param days – Time window in days (default: 30)
 * @returns MergedSessionStats and ranked popular products
 */
export async function fetchMergedAnalytics(days = 30): Promise<{
  sessionStats:    MergedSessionStats;
  popularProducts: MergedPopularProduct[];
}> {
  // ── 1. Attempt to fetch from Configurator ─────────────────
  let remoteStats: ConfiguratorSessionStats | null    = null;
  let remoteProducts: ConfiguratorPopularProduct[] | null = null;

  try {
    const summary = await configuratorFetch<ConfiguratorAnalyticsSummary>(
      `/analytics/summary?days=${days}`
    );
    remoteStats    = summary.sessionStats;
    remoteProducts = summary.popularProducts;
  } catch (err) {
    if (err instanceof ConfiguratorApiError && err.status === 404) {
      console.warn(
        "[FABRICK:Analytics] Configurator does not expose /analytics/summary – using local data only."
      );
    } else {
      console.error(
        "[FABRICK:Analytics] Failed to fetch Configurator analytics – using local data only.",
        err
      );
    }
  }

  // ── 2. Compute local fallback stats ───────────────────────
  const localStats    = computeLocalSessionStats(days);
  const localProducts = computeLocalPopularProducts(days);

  // ── 3. Merge session stats ────────────────────────────────
  const mergedStats: MergedSessionStats = remoteStats
    ? {
        totalSessions:      remoteStats.totalSessions + localStats.totalSessions,
        averageDurationSec: Math.round(
          (remoteStats.averageDurationSec * remoteStats.totalSessions +
            localStats.averageDurationSec * localStats.totalSessions) /
            Math.max(remoteStats.totalSessions + localStats.totalSessions, 1)
        ),
        abandonmentRate: parseFloat(
          (
            (remoteStats.abandonmentRate * remoteStats.totalSessions +
              localStats.abandonmentRate * localStats.totalSessions) /
            Math.max(remoteStats.totalSessions + localStats.totalSessions, 1)
          ).toFixed(4)
        ),
        localSessions:  localStats.totalSessions,
        remoteSessions: remoteStats.totalSessions,
        period:         remoteStats.period,
      }
    : {
        ...localStats,
        localSessions:  localStats.totalSessions,
        remoteSessions: 0,
      };

  // ── 4. Merge popular products ─────────────────────────────
  // Build a map: productId → merged row
  const mergedMap = new Map<string, MergedPopularProduct>();

  // Start with local products
  for (const p of localProducts) {
    mergedMap.set(p.productId, {
      id:               p.productId,
      name:             p.productName,
      category:         p.category,
      sessionViews:     p.sessionViews,
      combinationSaves: p.combinationSaves,
      totalScore:       p.totalScore,
      rank:             0, // assigned below
      source:           "local",
    });
  }

  // Merge in remote products (additive: scores are summed)
  if (remoteProducts) {
    for (const rp of remoteProducts) {
      const existing = mergedMap.get(rp.productId);
      if (existing) {
        mergedMap.set(rp.productId, {
          ...existing,
          sessionViews:     existing.sessionViews     + rp.sessionViews,
          combinationSaves: existing.combinationSaves + rp.combinationSaves,
          totalScore:       existing.totalScore        + rp.totalScore,
          source:           "merged",
        });
      } else {
        mergedMap.set(rp.productId, {
          id:               rp.productId,
          name:             rp.productName,
          category:         rp.category,
          sessionViews:     rp.sessionViews,
          combinationSaves: rp.combinationSaves,
          totalScore:       rp.totalScore,
          rank:             0,
          source:           "configurator",
        });
      }
    }
  }

  // Sort and assign dense ranks
  const sorted = Array.from(mergedMap.values()).sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.name.localeCompare(b.name, "sk");
  });

  let currentRank = 1;
  let prevScore: number | null = null;
  let counter = 0;
  for (const row of sorted) {
    counter++;
    if (prevScore === null || row.totalScore !== prevScore) currentRank = counter;
    row.rank   = currentRank;
    prevScore  = row.totalScore;
  }

  return {
    sessionStats:    mergedStats,
    popularProducts: sorted,
  };
}
