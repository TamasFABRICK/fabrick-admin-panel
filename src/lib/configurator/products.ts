/**
 * FABRICK Configurator Integration – Products Repository
 * ───────────────────────────────────────────────────────
 * All product reads/writes pass through this module.
 *
 * Read strategy (GET):
 *   1. If CONFIGURATOR_SYNC_MODE=live (default): fetch from Configurator API.
 *      On success, refresh the local snapshot.
 *      On failure, fall back to the local snapshot with a warning log.
 *   2. If CONFIGURATOR_SYNC_MODE=cached: serve directly from snapshot.
 *
 * Write strategy (POST / PATCH):
 *   - POST  → forward to Configurator API (creates new product)
 *   - PATCH → only allowlisted fields; enforced by writeGuard.assertSafePatch()
 *   - DELETE → ALWAYS redirected to soft-delete (status: "deleted"); writeGuard blocks hard delete
 *
 * Data protection rules (enforced by writeGuard):
 *   - Original product attributes (color, manufacturer, structure, format, category)
 *     cannot be overwritten from the Admin Panel.
 *   - Hard delete is permanently prohibited.
 */

import { configuratorFetch, getSyncMode, ConfiguratorApiError } from "./client";
import { refreshSnapshot, getCachedProducts }                    from "./syncCache";
import {
  assertSafeDelete,
  assertSafePatch,
  auditWrite,
  WriteGuardError,
} from "./writeGuard";
import type {
  ConfiguratorProduct,
  CreateProductPayload,
  PatchProductPayload,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Read operations
// ─────────────────────────────────────────────────────────────

export interface FetchProductsOptions {
  category?: string;
  status?:   string;
  q?:        string;
  page?:     number;
  limit?:    number;
}

/**
 * Fetches all products from the Configurator (Source of Truth).
 * Falls back to local snapshot on API failure.
 *
 * @returns Array of ConfiguratorProduct
 */

// ─────────────────────────────────────────────────────────────
// Real Configurator product adapter
// ─────────────────────────────────────────────────────────────

/**
 * Shape returned by the real Configurator API at GET /products.
 * Field names differ from our internal ConfiguratorProduct interface.
 */
interface RealConfiguratorProduct {
  code:            string;          // primary identifier (articleCode)
  articleCode?:    string;
  name:            string;
  manufacturer:    string | null;
  structure:       string | null;
  priceLevelId?:   string | null;
  formatLabel?:    string | null;   // e.g. "UK", "NF14"
  dimensions?:     string | null;   // e.g. "215x65 mm"
  exactPrice?:     number | null;
  colors?:         string[];        // array of color labels
  Dominantna_farba?: string | null; // dominant colour (Slovak field name)
  productType?:    string | null;
  object?:         string | null;
  bricksPerM2?:    string | number | null;
  analyzedImages?: number;
  Svetlost_index?: number;
  colorBreakdown?: Record<string, number>;
  // Standard fields (may be present in some responses)
  id?:          string;
  status?:      string;
  description?: string;
  imageUrl?:    string | null;
  textureUrls?: string[];
  tags?:        string[];
  createdAt?:   string;
  updatedAt?:   string;
}

function isRealProductShape(item: unknown): item is RealConfiguratorProduct {
  if (typeof item !== "object" || item === null) return false;
  const r = item as Record<string, unknown>;
  // Real Configurator products have 'code' or 'articleCode' instead of 'id'
  return ("code" in r || "articleCode" in r) && "name" in r;
}

function parseDimensions(dim: string | null | undefined): { width: number; height: number; depth: number } {
  if (!dim) return { width: 0, height: 0, depth: 0 };
  // e.g. "215x65 mm" → width=215, height=65, depth=65 (assumed)
  const match = dim.match(/(\d+)[x×](\d+)/);
  if (!match) return { width: 0, height: 0, depth: 0 };
  return { width: Number(match[1]), height: Number(match[2]), depth: Number(match[2]) };
}

/**
 * Adapts a real Configurator product record to our internal
 * ConfiguratorProduct interface.
 */
function adaptRealProduct(raw: RealConfiguratorProduct): ConfiguratorProduct {
  const now = new Date().toISOString();
  const dominantColor = raw.Dominantna_farba ?? (raw.colors?.[0] ?? null);
  return {
    id:           raw.id ?? raw.code ?? raw.articleCode ?? String(Math.random()),
    name:         raw.name,
    category:     "tehla" as ConfiguratorProduct["category"],  // real API has no category field; all are bricks
    description:  raw.description ?? "",
    format:       parseDimensions(raw.dimensions),
    imageUrl:     raw.imageUrl ?? null,
    textureUrls:  raw.textureUrls ?? [],
    color:        dominantColor,
    manufacturer: raw.manufacturer ?? null,
    structure:    raw.structure ?? null,
    priceLevelId: raw.priceLevelId ?? null,
    exactPrice:   raw.exactPrice ?? null,
    isManualPriceOverride: false,
    tags:         raw.tags ?? (raw.colors ?? []),
    // Real products have no status field – assume all are active
    status:       (raw.status as ConfiguratorProduct["status"]) ?? "active",
    createdAt:    raw.createdAt ?? now,
    updatedAt:    raw.updatedAt ?? now,
  };
}

export async function fetchAllProducts(
  options: FetchProductsOptions = {}
): Promise<ConfiguratorProduct[]> {
  if (getSyncMode() === "cached") {
    return getCachedProducts(true);
  }

  // Build query string (category/status/q may not be supported by real Configurator – sent anyway)
  const params = new URLSearchParams();
  if (options.category) params.set("category", options.category);
  if (options.status)   params.set("status",   options.status);
  if (options.q)        params.set("q",        options.q);
  if (options.page)     params.set("page",     String(options.page));
  if (options.limit)    params.set("limit",    String(options.limit));

  const qs       = params.toString();
  const endpoint = qs ? `/products?${qs}` : "/products";

  try {
    // Fetch as unknown so we can inspect the shape before casting
    const raw = await configuratorFetch<unknown>(endpoint);

    let products: ConfiguratorProduct[];

    if (Array.isArray(raw)) {
      // Flat array response – may be real or legacy shape
      if (raw.length > 0 && isRealProductShape(raw[0])) {
        // Real Configurator shape: adapt each item
        products = (raw as RealConfiguratorProduct[]).map(adaptRealProduct);
        console.info(`[FABRICK:Products] Adapted ${products.length} real Configurator products.`);
      } else {
        // Already matches our ConfiguratorProduct interface
        products = raw as ConfiguratorProduct[];
      }
    } else if (
      typeof raw === "object" &&
      raw !== null &&
      "data" in (raw as Record<string, unknown>) &&
      Array.isArray((raw as Record<string, unknown>).data)
    ) {
      // Envelope shape: { data: [...], count: N }
      const items = (raw as Record<string, unknown[]>).data;
      if (items.length > 0 && isRealProductShape(items[0])) {
        products = (items as RealConfiguratorProduct[]).map(adaptRealProduct);
        console.info(`[FABRICK:Products] Adapted ${products.length} real Configurator products (envelope shape).`);
      } else {
        products = items as ConfiguratorProduct[];
      }
    } else {
      console.error(
        "[FABRICK:Products] Unexpected response shape from Configurator /products:\n",
        JSON.stringify(raw).substring(0, 300)
      );
      return getCachedProducts(true);
    }

    // Refresh snapshot after every successful live fetch
    refreshSnapshot(products);
    return products;

  } catch (err) {
    if (err instanceof ConfiguratorApiError) {
      console.error(
        `[FABRICK:Products] Configurator API error (${err.status}) – falling back to snapshot.`,
        err.message
      );
    } else {
      console.error("[FABRICK:Products] Network error – falling back to snapshot.", err);
    }
    return getCachedProducts(true);
  }
}

/**
 * Fetches a single product by its Configurator ID.
 * Falls back to the snapshot if the API is unavailable.
 *
 * @param id – Configurator product UUID
 * @returns ConfiguratorProduct or null if not found
 */
export async function fetchProductById(
  id: string
): Promise<ConfiguratorProduct | null> {
  if (getSyncMode() === "cached") {
    return getCachedProducts(true).find((p) => p.id === id) ?? null;
  }

  try {
    const product = await configuratorFetch<ConfiguratorProduct>(`/products/${id}`);
    return product;
  } catch (err) {
    if (err instanceof ConfiguratorApiError && err.status === 404) {
      return null;
    }
    console.error(`[FABRICK:Products] Failed to fetch product ${id} – falling back to snapshot.`, err);
    return getCachedProducts(true).find((p) => p.id === id) ?? null;
  }
}

// ─────────────────────────────────────────────────────────────
// Write operations
// ─────────────────────────────────────────────────────────────

/**
 * Creates a new product in the Configurator.
 *
 * @param data    – Product payload (see CreateProductPayload)
 * @param actorId – Admin user ID for audit trail
 * @returns The created ConfiguratorProduct (with server-assigned ID)
 * @throws ConfiguratorApiError on API failure
 */
export async function createProduct(
  data:    CreateProductPayload,
  actorId: string
): Promise<ConfiguratorProduct> {
  const created = await configuratorFetch<ConfiguratorProduct>("/products", {
    method: "POST",
    body:   data,
  });

  auditWrite("create", created.id, actorId, data);
  return created;
}

/**
 * Partially updates a product in the Configurator.
 *
 * Only fields in the PATCH_ALLOWED_FIELDS allowlist are forwarded.
 * Any other fields in `patch` are silently stripped by writeGuard.
 *
 * @param id      – Configurator product UUID
 * @param patch   – Raw patch body (will be filtered by writeGuard)
 * @param actorId – Admin user ID for audit trail
 * @returns The updated ConfiguratorProduct
 * @throws WriteGuardError if the patch contains invalid data
 * @throws ConfiguratorApiError on API failure
 */
export async function updateProduct(
  id:      string,
  patch:   Record<string, unknown>,
  actorId: string
): Promise<ConfiguratorProduct> {
  // writeGuard strips disallowed fields and validates status values
  const safePatch = assertSafePatch(patch) as PatchProductPayload;

  const updated = await configuratorFetch<ConfiguratorProduct>(`/products/${id}`, {
    method: "PATCH",
    body:   safePatch,
  });

  auditWrite("update", id, actorId, safePatch);
  return updated;
}

/**
 * Soft-deletes a product by setting its status to "deleted" in the Configurator.
 *
 * This is the ONLY deletion mechanism available. Hard delete is permanently
 * blocked by writeGuard.assertSafeDelete().
 *
 * @param id      – Configurator product UUID
 * @param actorId – Admin user ID for audit trail
 * @returns The updated ConfiguratorProduct with status: "deleted"
 */
export async function softDeleteProduct(
  id:      string,
  actorId: string
): Promise<ConfiguratorProduct> {
  const updated = await configuratorFetch<ConfiguratorProduct>(`/products/${id}`, {
    method: "PATCH",
    body:   { status: "deleted" },
  });

  auditWrite("soft-delete", id, actorId, { status: "deleted" });
  return updated;
}

/**
 * Permanently prohibited. Exists only to make the prohibition explicit
 * and produce a helpful error message when mistakenly called.
 *
 * @throws WriteGuardError(405) unconditionally
 */
export function hardDeleteProduct(_id: string): never {
  assertSafeDelete(); // always throws WriteGuardError(405)
}

// Re-export WriteGuardError so route handlers can import from one place
export { WriteGuardError };
