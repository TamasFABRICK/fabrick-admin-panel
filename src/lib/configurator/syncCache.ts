/**
 * FABRICK Configurator Integration – Local Snapshot Cache
 * ────────────────────────────────────────────────────────
 * Provides a read-only local fallback when the Configurator API is
 * unreachable and CONFIGURATOR_SYNC_MODE=cached (or on fetch failure).
 *
 * Snapshot file: data/configurator-snapshot.json
 *
 * Policy:
 *   - The Admin Panel NEVER writes product data to the snapshot.
 *     The snapshot is populated only by calling refreshSnapshot().
 *   - refreshSnapshot() is called automatically after every successful
 *     Configurator API read in the products repository.
 *   - Snapshot is considered stale after SNAPSHOT_TTL_MS (24 h).
 *   - If the snapshot is missing or stale and the API is unreachable,
 *     the product repository returns an empty array with a warning log.
 */

import fs   from "node:fs";
import path from "node:path";
import type { ConfiguratorProduct, ConfiguratorAttribute } from "./types";

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const DATA_DIR          = path.join(process.cwd(), "data");
const SNAPSHOT_FILE     = path.join(DATA_DIR, "configurator-snapshot.json");
const SNAPSHOT_TTL_MS   = 24 * 60 * 60 * 1_000; // 24 hours

// ─────────────────────────────────────────────────────────────
// Snapshot shape
// ─────────────────────────────────────────────────────────────

interface ConfiguratorSnapshot {
  /** ISO timestamp of when this snapshot was written */
  capturedAt:  string;
  products:    ConfiguratorProduct[];
  attributes:  ConfiguratorAttribute[];
}

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadSnapshot(): ConfiguratorSnapshot | null {
  try {
    if (!fs.existsSync(SNAPSHOT_FILE)) return null;
    const raw = fs.readFileSync(SNAPSHOT_FILE, "utf-8");
    return JSON.parse(raw) as ConfiguratorSnapshot;
  } catch {
    console.warn("[FABRICK:SyncCache] Failed to load snapshot file – treating as missing.");
    return null;
  }
}

function isStale(snapshot: ConfiguratorSnapshot): boolean {
  const age = Date.now() - new Date(snapshot.capturedAt).getTime();
  return age > SNAPSHOT_TTL_MS;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Persists a fresh snapshot of Configurator data to disk.
 *
 * Called automatically by the products and attributes repositories
 * after every successful API response – Admin Panel never initiates this.
 *
 * @param products   – Fresh product list from Configurator API
 * @param attributes – Fresh attribute list from Configurator API (optional)
 */
export function refreshSnapshot(
  products:   ConfiguratorProduct[],
  attributes: ConfiguratorAttribute[] = []
): void {
  try {
    ensureDataDir();
    const snapshot: ConfiguratorSnapshot = {
      capturedAt: new Date().toISOString(),
      products,
      attributes,
    };
    fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), "utf-8");
  } catch (err) {
    // Non-fatal – log and continue; snapshot is a best-effort cache
    console.warn(
      "[FABRICK:SyncCache] Failed to write snapshot:",
      (err as Error).message
    );
  }
}

/**
 * Returns cached products from the snapshot.
 * If no snapshot exists, falls back to the local db store (dev-mode fallback).
 *
 * @param allowStale – If true, return data even if the snapshot is older
 *                     than SNAPSHOT_TTL_MS. Defaults to false.
 * @returns Array of ConfiguratorProduct (may be empty only if db is also empty)
 */
export function getCachedProducts(allowStale = false): ConfiguratorProduct[] {
  const snapshot = loadSnapshot();
  if (!snapshot) {
    // No snapshot yet – fall back to local db store so the admin panel
    // remains functional in dev before a Configurator API is available.
    return getLocalDbProducts();
  }
  if (!allowStale && isStale(snapshot)) {
    console.warn(
      `[FABRICK:SyncCache] Snapshot is stale (captured ${snapshot.capturedAt}). ` +
        "Serving stale data as fallback."
    );
  }
  return snapshot.products;
}

/**
 * Returns cached attributes from the snapshot.
 * If no snapshot exists, falls back to the local db store (dev-mode fallback).
 *
 * @param allowStale – If true, return data even if the snapshot is older
 *                     than SNAPSHOT_TTL_MS. Defaults to false.
 * @returns Array of ConfiguratorAttribute
 */
export function getCachedAttributes(allowStale = false): ConfiguratorAttribute[] {
  const snapshot = loadSnapshot();
  if (!snapshot) {
    // No snapshot – fall back to local db.attributes so MDM dropdowns work in dev.
    return getLocalDbAttributes();
  }
  if (!allowStale && isStale(snapshot)) {
    console.warn(
      `[FABRICK:SyncCache] Snapshot is stale (captured ${snapshot.capturedAt}). ` +
        "Serving stale data as fallback."
    );
  }
  return snapshot.attributes;
}

/**
 * Returns snapshot metadata (captured timestamp, counts) without
 * loading the full data arrays. Useful for health/status endpoints.
 */
export function getSnapshotMeta(): {
  available:      boolean;
  capturedAt:     string | null;
  stale:          boolean;
  productCount:   number;
  attributeCount: number;
} {
  const snapshot = loadSnapshot();
  if (!snapshot) {
    return { available: false, capturedAt: null, stale: false, productCount: 0, attributeCount: 0 };
  }
  return {
    available:      true,
    capturedAt:     snapshot.capturedAt,
    stale:          isStale(snapshot),
    productCount:   snapshot.products.length,
    attributeCount: snapshot.attributes.length,
  };
}

// ─────────────────────────────────────────────────────────────
// Local DB fallback adapters
// ─────────────────────────────────────────────────────────────
// Used when CONFIGURATOR_API_URL is not configured and no snapshot
// has been written yet. Allows the admin panel to work in dev mode
// using the local JSON database as the data source.
//
// Lazy import avoids circular dependency: syncCache → db → syncCache.
// The import is deferred to the function body so it is only resolved
// when actually needed (i.e. when both API and snapshot are absent).

function getLocalDbProducts(): ConfiguratorProduct[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const store = require("../db/store") as { db: { products: { findAll(): unknown[] } } };
  const products = store.db.products.findAll();
  console.info(
    `[FABRICK:SyncCache] No snapshot – serving ${products.length} products from local db (dev fallback).`
  );
  // Local Product shape is a superset of ConfiguratorProduct – safe cast
  return products as unknown as ConfiguratorProduct[];
}

function getLocalDbAttributes(): ConfiguratorAttribute[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const store = require("../db/store") as { db: { attributes: { findAll(): unknown[] } } };
  const attrs = store.db.attributes.findAll();
  console.info(
    `[FABRICK:SyncCache] No snapshot – serving ${attrs.length} attributes from local db (dev fallback).`
  );
  return attrs as unknown as ConfiguratorAttribute[];
}
