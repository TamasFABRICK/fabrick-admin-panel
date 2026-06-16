/**
 * FABRICK Admin Panel – Attribute Query Helpers
 * ──────────────────────────────────────────────
 * Thin utilities over db.attributes for common MDM read patterns.
 * Keeps route handlers concise and testable.
 */

import { db } from "./store";
import type { AttributeType, GlobalAttribute } from "./schema";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface AttributeGroup {
  label: string;
  value: string;
  meta: string | null;
  sortOrder: number;
  id: string;
  active: boolean;
}

export interface GroupedAttributes {
  colors: AttributeGroup[];
  manufacturers: AttributeGroup[];
  structures: AttributeGroup[];
  formats: AttributeGroup[];
  priceLevels: AttributeGroup[];
  patterns: AttributeGroup[];
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Maps a GlobalAttribute to the compact shape sent in API responses.
 * `value` equals `label` – kept separate for future i18n / slug support.
 */
function toGroup(attr: GlobalAttribute): AttributeGroup {
  return {
    id:        attr.id,
    label:     attr.label,
    value:     attr.label,
    meta:      attr.meta,
    sortOrder: attr.sortOrder,
    active:    attr.active,
  };
}

/**
 * Returns all **active** attributes grouped by type, sorted by sortOrder.
 * Used by GET /api/attributes (public, no auth required).
 */
export function getGroupedAttributes(): GroupedAttributes {
  const all = db.attributes.findAll();
  const active = all.filter((a) => a.active).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)
  );

  return {
    colors:        active.filter((a) => a.type === "color").map(toGroup),
    manufacturers: active.filter((a) => a.type === "manufacturer").map(toGroup),
    structures:    active.filter((a) => a.type === "structure").map(toGroup),
    formats:       active.filter((a) => a.type === "format").map(toGroup),
    priceLevels:   active.filter((a) => a.type === "priceLevel").map(toGroup),
    patterns:      active.filter((a) => a.type === "pattern").map(toGroup),
  };
}

/**
 * Same as getGroupedAttributes() but includes inactive records.
 * Used by admin-authenticated requests (?includeInactive=true).
 */
export function getAllGroupedAttributes(): GroupedAttributes {
  const all = db.attributes.findAll().sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)
  );

  return {
    colors:        all.filter((a) => a.type === "color").map(toGroup),
    manufacturers: all.filter((a) => a.type === "manufacturer").map(toGroup),
    structures:    all.filter((a) => a.type === "structure").map(toGroup),
    formats:       all.filter((a) => a.type === "format").map(toGroup),
    priceLevels:   all.filter((a) => a.type === "priceLevel").map(toGroup),
    patterns:      all.filter((a) => a.type === "pattern").map(toGroup),
  };
}

/**
 * Checks whether an attribute with the same type + label (case-insensitive) already exists.
 * Used by POST /api/attributes to return 409 Conflict instead of creating duplicates.
 *
 * @param type       - The AttributeType discriminant
 * @param label      - The display label to check
 * @param excludeId  - Optional – exclude a specific record (for PATCH validation)
 */
export function isDuplicateAttribute(
  type: AttributeType,
  label: string,
  excludeId?: string
): boolean {
  const normalised = label.trim().toLowerCase();
  return db.attributes
    .findAll()
    .some(
      (a) =>
        a.type === type &&
        a.label.trim().toLowerCase() === normalised &&
        a.id !== excludeId
    );
}

/**
 * Returns a flat list of active attribute labels for a given type.
 * Convenience wrapper for use in product field validation:
 *   if (!getAttributeValues("color").includes(body.color)) → 422
 *
 * NOTE: As of Sprint 3, product fields are open-string (no FK).
 * This helper is provided for future strict validation if MDM coupling is desired.
 */
export function getAttributeValues(type: AttributeType): string[] {
  return db.attributes
    .findAll()
    .filter((a) => a.active && a.type === type)
    .map((a) => a.label);
}
