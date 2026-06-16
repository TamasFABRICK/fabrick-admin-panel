/**
 * FABRICK Configurator Integration – Attributes Repository
 * ─────────────────────────────────────────────────────────
 * MDM (Master Data Management) attributes are the Source of Truth
 * for all dropdown options in the Configurator: colors, manufacturers,
 * structures, formats, and price levels.
 *
 * Read strategy:
 *   - Live fetch from Configurator API (SYNC_MODE=live, default)
 *   - Falls back to local snapshot on failure
 *
 * Write strategy:
 *   - Admin Panel may create NEW attributes via POST to Configurator
 *   - Admin Panel may soft-deactivate attributes (active: false) via PATCH
 *   - Admin Panel may NOT delete or rename existing attributes
 */

import { configuratorFetch, getSyncMode, ConfiguratorApiError } from "./client";
import { refreshSnapshot, getCachedAttributes }                  from "./syncCache";
import { auditWrite }                                            from "./writeGuard";
import type { ConfiguratorAttribute, ConfiguratorAttributeType } from "./types";

// ─────────────────────────────────────────────────────────────
// Grouped attribute shape (mirrors existing AttributeGroup)
// ─────────────────────────────────────────────────────────────

export interface AttributeOption {
  id:        string;
  label:     string;
  value:     string;  // Same as label – reserved for future i18n/slug support
  meta:      string | null;
  sortOrder: number;
  active:    boolean;
}

export interface GroupedAttributes {
  colors:        AttributeOption[];
  manufacturers: AttributeOption[];
  structures:    AttributeOption[];
  formats:       AttributeOption[];
  priceLevels:   AttributeOption[];
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function toOption(attr: ConfiguratorAttribute): AttributeOption {
  return {
    id:        attr.id,
    label:     attr.label,
    value:     attr.label,
    meta:      attr.meta,
    sortOrder: attr.sortOrder,
    active:    attr.active,
  };
}

function groupAttributes(
  attrs:          ConfiguratorAttribute[],
  includeInactive: boolean
): GroupedAttributes {
  let safeAttrs = Array.isArray(attrs) ? attrs : [];
  if (!Array.isArray(attrs) && attrs !== null && typeof attrs === 'object') {
    if (Array.isArray((attrs as any).data)) safeAttrs = (attrs as any).data;
    else if (Array.isArray((attrs as any).attributes)) safeAttrs = (attrs as any).attributes;
  }

  const filtered = includeInactive
    ? safeAttrs
    : safeAttrs.filter((a) => a.active);

  const sorted = [...filtered].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "sk")
  );

  return {
    colors:        sorted.filter((a) => a.type === "color").map(toOption),
    manufacturers: sorted.filter((a) => a.type === "manufacturer").map(toOption),
    structures:    sorted.filter((a) => a.type === "structure").map(toOption),
    formats:       sorted.filter((a) => a.type === "format").map(toOption),
    priceLevels:   sorted.filter((a) => a.type === "priceLevel").map(toOption),
  };
}

// ─────────────────────────────────────────────────────────────
// Read operations
// ─────────────────────────────────────────────────────────────

/**
 * Returns all attributes from the Configurator, grouped by type.
 *
 * @param includeInactive – If true, includes soft-deleted/inactive attributes
 * @returns GroupedAttributes object
 */
// ─────────────────────────────────────────────────────────────
// Real Configurator response adapter
// ─────────────────────────────────────────────────────────────

/**
 * The real Configurator API returns attributes already grouped as:
 *   { colors: string[], manufacturers: string[], structures: string[],
 *     formats: string[], priceLevels: string[] }
 *
 * This adapter converts that shape directly into GroupedAttributes
 * (with synthesised AttributeOption objects so the rest of the Admin
 * Panel continues to work without changes).
 */
interface ConfiguratorGroupedResponse {
  colors?:        string[];
  manufacturers?: string[];
  structures?:    string[];
  formats?:       string[];
  priceLevels?:   string[];
}

function stringsToOptions(
  labels: string[],
  type:   string
): AttributeOption[] {
  return labels.map((label, idx) => ({
    id:        `${type}-${idx}-${label.replace(/\s+/g, "-").toLowerCase()}`,
    label,
    value:     label,
    meta:      null,
    sortOrder: idx,
    active:    true,
  }));
}

function isGroupedResponse(raw: unknown): raw is ConfiguratorGroupedResponse {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return false;
  const r = raw as Record<string, unknown>;
  // If at least one of the group keys is a string array, treat as grouped
  const groupKeys = ["colors", "manufacturers", "structures", "formats", "priceLevels"];
  return groupKeys.some(
    (k) => k in r && Array.isArray(r[k])
  );
}

function adaptGroupedResponse(raw: ConfiguratorGroupedResponse): GroupedAttributes {
  return {
    colors:        stringsToOptions(raw.colors        ?? [], "color"),
    manufacturers: stringsToOptions(raw.manufacturers ?? [], "manufacturer"),
    structures:    stringsToOptions(raw.structures    ?? [], "structure"),
    formats:       stringsToOptions(raw.formats       ?? [], "format"),
    priceLevels:   stringsToOptions(raw.priceLevels   ?? [], "priceLevel"),
  };
}

/**
 * Converts a GroupedAttributes back into a flat ConfiguratorAttribute[]
 * so the snapshot mechanism stays compatible.
 */
function flattenGrouped(grouped: GroupedAttributes): ConfiguratorAttribute[] {
  const now = new Date().toISOString();
  const all: ConfiguratorAttribute[] = [];
  const typeMap: Array<[keyof GroupedAttributes, import("./types").ConfiguratorAttributeType]> = [
    ["colors",        "color"],
    ["manufacturers", "manufacturer"],
    ["structures",    "structure"],
    ["formats",       "format"],
    ["priceLevels",   "priceLevel"],
  ];
  for (const [groupKey, type] of typeMap) {
    for (const opt of grouped[groupKey]) {
      all.push({
        id:        opt.id,
        type,
        label:     opt.label,
        meta:      null,
        sortOrder: opt.sortOrder,
        active:    true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return all;
}

// ─────────────────────────────────────────────────────────────
// Read operations
// ─────────────────────────────────────────────────────────────

/**
 * Returns all attributes from the Configurator, grouped by type.
 * Handles both the legacy flat-array shape AND the real Configurator
 * pre-grouped shape { colors: string[], manufacturers: string[], ... }.
 *
 * @param includeInactive – Ignored when using real Configurator (all labels
 *                          returned are considered active). Respected for
 *                          local-snapshot fallback data.
 * @returns GroupedAttributes object
 */
export async function fetchGroupedAttributes(
  includeInactive = false
): Promise<GroupedAttributes> {
  if (getSyncMode() === "cached") {
    const cached = getCachedAttributes(true);
    return groupAttributes(cached, includeInactive);
  }

  try {
    // Fetch as unknown – we will inspect the shape before casting
    const raw = await configuratorFetch<unknown>("/attributes");

    if (isGroupedResponse(raw)) {
      // Real Configurator: returns pre-grouped { colors: [...], ... }
      const grouped = adaptGroupedResponse(raw as ConfiguratorGroupedResponse);
      // Persist flattened version to snapshot for offline fallback
      refreshSnapshot([], flattenGrouped(grouped));
      return grouped;
    }

    // Legacy / future shape: flat ConfiguratorAttribute[]
    if (Array.isArray(raw)) {
      const attrs = raw as ConfiguratorAttribute[];
      refreshSnapshot([], attrs);
      return groupAttributes(attrs, includeInactive);
    }

    // Unknown shape – log and fall back
    console.error(
      "[FABRICK:Attributes] Unexpected response shape from Configurator /attributes:\n",
      JSON.stringify(raw).substring(0, 300)
    );
    return groupAttributes(getCachedAttributes(true), includeInactive);

  } catch (err) {
    if (err instanceof ConfiguratorApiError) {
      console.error(
        `[FABRICK:Attributes] Configurator API error (${err.status}) – falling back to snapshot.`,
        err.message
      );
    } else {
      console.error("[FABRICK:Attributes] Network error – falling back to snapshot.", err);
    }
    return groupAttributes(getCachedAttributes(true), includeInactive);
  }
}

/**
 * Returns a flat list of all attributes.
 * Used by snapshot and validation helpers.
 *
 * NOTE: The real Configurator returns a grouped shape; this function
 * adapts it to a flat array for downstream compatibility.
 */
export async function fetchAllAttributes(): Promise<ConfiguratorAttribute[]> {
  const grouped = await fetchGroupedAttributes(true);
  return flattenGrouped(grouped);
}

/**
 * Returns active attribute labels for a given type.
 * Convenience wrapper for use in product field validation.
 *
 * @param type – AttributeType discriminant
 * @returns Array of label strings
 */
export async function fetchAttributeValues(
  type: ConfiguratorAttributeType
): Promise<string[]> {
  const all = await fetchAllAttributes();
  return all
    .filter((a) => a.active && a.type === type)
    .map((a) => a.label);
}

// ─────────────────────────────────────────────────────────────
// Write operations
// ─────────────────────────────────────────────────────────────

export interface CreateAttributePayload {
  type:       ConfiguratorAttributeType;
  label:      string;
  meta?:      string | null;
  sortOrder?: number;
}

/**
 * Creates a new attribute in the Configurator's MDM.
 *
 * @param data    – Attribute payload
 * @param actorId – Admin user ID for audit trail
 * @returns The created ConfiguratorAttribute
 */
export async function createAttribute(
  data:    CreateAttributePayload,
  actorId: string
): Promise<ConfiguratorAttribute> {
  const created = await configuratorFetch<ConfiguratorAttribute>("/attributes", {
    method: "POST",
    body:   data,
  });

  auditWrite("create", created.id, actorId, data);
  return created;
}

/**
 * Soft-deactivates an attribute by setting active: false in the Configurator.
 * The attribute record is preserved for historical referential integrity.
 *
 * @param id      – Configurator attribute UUID
 * @param actorId – Admin user ID for audit trail
 * @returns The updated ConfiguratorAttribute with active: false
 */
export async function deactivateAttribute(
  id:      string,
  actorId: string
): Promise<ConfiguratorAttribute> {
  const updated = await configuratorFetch<ConfiguratorAttribute>(`/attributes/${id}`, {
    method: "PATCH",
    body:   { active: false },
  });

  auditWrite("soft-delete", id, actorId, { active: false });
  return updated;
}
