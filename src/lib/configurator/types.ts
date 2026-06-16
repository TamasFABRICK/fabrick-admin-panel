/**
 * FABRICK Configurator Integration – Shared TypeScript Types
 * ──────────────────────────────────────────────────────────
 * These interfaces mirror the exact JSON shapes returned by the
 * public Configurator REST API (Source of Truth).
 *
 * DO NOT add Admin-Panel-specific fields here.
 * Admin-Panel extensions live in src/lib/db/schema.ts (Product interface).
 *
 * Keep in sync with the Configurator's OpenAPI spec / response payloads.
 */

// ─────────────────────────────────────────────────────────────
// Primitive aliases
// ─────────────────────────────────────────────────────────────

export type ConfiguratorId   = string; // UUID as returned by the Configurator
export type ISODateString    = string; // ISO 8601

// ─────────────────────────────────────────────────────────────
// Product
// ─────────────────────────────────────────────────────────────

export type ConfiguratorProductCategory = "tehla" | "vazba" | "skara" | "other";
export type ConfiguratorProductStatus   = "active" | "hidden" | "deleted";

export interface ConfiguratorProductFormat {
  /** Width in mm */
  width:  number;
  /** Height in mm */
  height: number;
  /** Depth in mm */
  depth:  number;
}

/**
 * Exact shape returned by GET /products and GET /products/:id
 * on the Configurator API.
 */
export interface ConfiguratorProduct {
  id:           ConfiguratorId;
  name:         string;
  category:     ConfiguratorProductCategory;
  description:  string;
  format:       ConfiguratorProductFormat;
  /** Legacy field – prefer textureUrls */
  imageUrl:     string | null;
  textureUrls:  string[];
  color:        string | null;
  manufacturer: string | null;
  structure:    string | null;
  priceLevelId: string | null;
  formatConfigId?: string | null;
  exactPrice:   number | null;
  isManualPriceOverride: boolean;
  tags:         string[];
  status:       ConfiguratorProductStatus;
  createdAt:    ISODateString;
  updatedAt:    ISODateString;
}

// ─────────────────────────────────────────────────────────────
// Attribute (MDM)
// ─────────────────────────────────────────────────────────────

export type ConfiguratorAttributeType =
  | "color"
  | "manufacturer"
  | "structure"
  | "format"
  | "priceLevel";

/**
 * Exact shape returned by GET /attributes on the Configurator API.
 */
export interface ConfiguratorAttribute {
  id:        ConfiguratorId;
  type:      ConfiguratorAttributeType;
  label:     string;
  meta:      string | null;
  sortOrder: number;
  active:    boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ─────────────────────────────────────────────────────────────
// Contact (CRM lead from Configurator)
// ─────────────────────────────────────────────────────────────

export type ConfiguratorContactSource =
  | "visualizer"
  | "webhook"
  | "manual"
  | "n8n";

export interface ConfiguratorContactCombination {
  brickId:  ConfiguratorId | null;
  mortarId: ConfiguratorId | null;
  bondId:   ConfiguratorId | null;
}

/**
 * Exact shape returned by GET /contacts on the Configurator API.
 * This is read-only from the Admin Panel perspective.
 */
export interface ConfiguratorContact {
  id:          ConfiguratorId;
  name:        string;
  email:       string;
  phone:       string | null;
  company:     string | null;
  source:      ConfiguratorContactSource;
  combination: ConfiguratorContactCombination | null;
  metadata:    Record<string, unknown>;
  gdprConsent: boolean;
  createdAt:   ISODateString;
  updatedAt:   ISODateString;
}

// ─────────────────────────────────────────────────────────────
// Write payloads (Admin Panel → Configurator)
// ─────────────────────────────────────────────────────────────

/**
 * Body sent to POST /products on the Configurator.
 * All fields mirror ConfiguratorProduct minus server-managed fields.
 */
export interface CreateProductPayload {
  name:         string;
  category:     ConfiguratorProductCategory;
  description?: string;
  format?:      ConfiguratorProductFormat;
  color?:       string | null;
  manufacturer?: string | null;
  structure?:   string | null;
  priceLevelId?: string | null;
  formatConfigId?: string | null;
  exactPrice?:  number | null;
  isManualPriceOverride?: boolean;
  tags?:        string[];
  status?:      ConfiguratorProductStatus;
  imageUrl?:    string | null;
  textureUrls?: string[];
}

/**
 * Body sent to PATCH /products/:id on the Configurator.
 * ONLY the allowlisted fields below are permitted.
 * Original attributes (color, manufacturer, structure, format)
 * cannot be overwritten from the Admin Panel.
 */
export interface PatchProductPayload {
  status?:     ConfiguratorProductStatus;
  tags?:       string[];
  /** Admin-internal note field – may be ignored by the Configurator */
  adminNotes?: string | null;
}

// ─────────────────────────────────────────────────────────────
// Standard API envelope from the Configurator
// ─────────────────────────────────────────────────────────────

export interface ConfiguratorApiResponse<T> {
  success: boolean;
  data:    T;
  meta?:   {
    total?:  number;
    page?:   number;
    limit?:  number;
  };
  error?: string;
}
