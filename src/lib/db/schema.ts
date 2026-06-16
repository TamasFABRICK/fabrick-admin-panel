/**
 * FABRICK Admin Panel – Database Schema
 * ─────────────────────────────────────
 * Pure TypeScript interfaces + runtime-safe validation helpers.
 * No external ORM / DB driver required – the in-memory store (seed.ts)
 * implements these shapes. Swap with Prisma / Drizzle when ready.
 */

// ─────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────

export type ISODateString = string; // ISO 8601, e.g. "2026-05-27T22:00:00Z"
export type UUID = string;

// ─────────────────────────────────────────────────────────────
// User (Admin accounts)
// ─────────────────────────────────────────────────────────────

export type UserRole = "super_admin" | "admin" | "viewer";

export interface User {
  id: UUID;
  email: string;
  /** bcrypt hash – never expose in API responses */
  passwordHash: string;
  name: string;
  role: UserRole;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  lastLoginAt: ISODateString | null;
}

/** Shape returned in API responses (no sensitive fields) */
export type UserPublic = Omit<User, "passwordHash">;

// ─────────────────────────────────────────────────────────────
// Product (Tehly, väzby, škáry – product catalogue)
// ─────────────────────────────────────────────────────────────

export type ProductCategory = "tehla" | "vazba" | "skara" | "other";
export type ProductStatus = "active" | "hidden" | "deleted";
/**
 * Open string taxonomy – accepts ANY non-empty string value.
 * Seed defaults: "economy" | "standard" | "premium" | "luxury".
 * New values can be added via the admin form without code changes.
 * For the configurator: query unique values with SELECT DISTINCT priceLevel.
 */
export type PriceLevel = string;

export interface ProductFormat {
  /** mm */
  width: number;
  /** mm */
  height: number;
  /** mm */
  depth: number;
}

export interface Product {
  id: UUID;
  name: string;
  category: ProductCategory;
  description: string;
  format: ProductFormat;
  /** @deprecated Use thumbnailUrl. Kept for backward compatibility. */
  imageUrl: string | null;
  /** Profilová fotka produktu – relatívna URL (/uploads/products/thumbnails/<uuid>.ext) */
  thumbnailUrl: string | null;
  /** Textúry pre 3D generátor – relatívne URL adresy */
  textureUrls: string[];
  /** Farba tehly / povrchu (napr. "červená", "šedá") */
  color: string | null;
  /** Výrobca / značka (napr. "Wienerberger", "Tondach") */
  manufacturer: string | null;
  /** Povrchová štruktúra (napr. "hladká", "rustikálna", "loft", "antik") */
  structure: string | null;
  /** Cenová úroveň */
  priceLevel: PriceLevel | null;
  status: ProductStatus;
  /** Tags for N8N workflow filtering */
  tags: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: UUID;

  // ── Admin Panel extension fields ─────────────────────────
  // These fields are NOT present in the Configurator's data model.
  // They exist only in the Admin Panel's local metadata layer.

  /**
   * Internal admin notes – never forwarded to the Configurator.
   * Used by sales/marketing team for internal annotations.
   */
  adminNotes: string | null;

  /**
   * The product's UUID in the Configurator system.
   * null for products created locally before integration, or for
   * products that exist only in the Admin Panel.
   * When set, this ID is used for all Configurator API calls.
   */
  configuratorId: UUID | null;

  /**
   * ISO timestamp of the last successful synchronisation from the
   * Configurator API. Used to detect stale local metadata.
   * null if the product has never been synced.
   */
  lastSyncedAt: ISODateString | null;
}

// ─────────────────────────────────────────────────────────────
// Contact (CRM – architects / clients)
// ─────────────────────────────────────────────────────────────

export type ContactSource = "visualizer" | "webhook" | "manual" | "n8n";

export interface ContactCombination {
  brickId: UUID | null;
  mortarId: UUID | null;
  bondId: UUID | null;
}

export interface Contact {
  id: UUID;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  source: ContactSource;
  /** The product combination the contact generated / downloaded */
  combination: ContactCombination | null;
  /** Arbitrary metadata forwarded by N8N / MCP webhooks */
  metadata: Record<string, unknown>;
  gdprConsent: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

// ─────────────────────────────────────────────────────────────
// Analytics Session (Visualizer usage tracking)
// ─────────────────────────────────────────────────────────────

export type SessionEvent =
  | "session_start"
  | "combination_saved"
  | "texture_downloaded"
  | "contact_submitted"
  | "session_end";

export interface AnalyticsEvent {
  event: SessionEvent;
  timestamp: ISODateString;
  payload: Record<string, unknown>;
}

export interface AnalyticsSession {
  id: UUID;
  /** Anonymous fingerprint – no PII */
  fingerprint: string;
  /** UTC start timestamp */
  startedAt: ISODateString;
  /** UTC end timestamp; null while session is live */
  endedAt: ISODateString | null;
  /** Duration in seconds; computed on session end */
  durationSeconds: number | null;
  /** Did the user leave without submitting a contact? */
  abandoned: boolean;
  events: AnalyticsEvent[];
  /** Selected product IDs during this session */
  viewedProducts: UUID[];
  referrer: string | null;
  userAgent: string | null;
}

// ─────────────────────────────────────────────────────────────
// GlobalAttribute (MDM – Master Data Management)
// ─────────────────────────────────────────────────────────────

/**
 * Discriminant type for the GlobalAttributes MDM table.
 * One entity, five logical lists – separated by `type` field.
 *
 * Configurator dropdowns use SELECT DISTINCT on the active records
 * to build their option lists (no FK coupling to Product).
 */
export type AttributeType =
  | "color"
  | "manufacturer"
  | "structure"
  | "format"
  | "priceLevel"
  | "pattern";

export interface GlobalAttribute {
  id: UUID;
  /** Which attribute list this record belongs to */
  type: AttributeType;
  /** Display label shown in UI dropdowns (e.g. "Fialová glazúra", "Wienerberger") */
  label: string;
  /**
   * Optional machine-readable metadata stored as an opaque JSON string.
   * Currently used by type="format" to carry human-readable description.
   * Example: '{"description":"Standard NF brick, used in most SK/CZ projects"}'
   * Future: numerical dimensions for canvas calculators.
   */
  meta: string | null;
  /** Ascending sort order for UI dropdowns; defaults to insertion order */
  sortOrder: number;
  /**
   * Soft-delete flag. false = hidden from public dropdowns but preserved
   * so historical Product.color/manufacturer/etc. values remain meaningful.
   */
  active: boolean;
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy: UUID;
}

// ─────────────────────────────────────────────────────────────
// MarketingSettings (Singleton – one record per installation)
// ─────────────────────────────────────────────────────────────

/**
 * Global marketing and SEO settings managed from the Admin Panel.
 *
 * This is a SINGLETON entity – there is exactly one record in the
 * entire system. It is never stored in an array.
 *
 * Admin API (write-role):  GET / PUT  /api/settings/marketing
 * Public API (no auth):    GET        /api/public/settings
 *
 * The public endpoint exposes only the 7 tracking/SEO fields.
 * Audit fields (updatedAt, updatedBy) are never sent to the public.
 */
export interface MarketingSettings {
  /** Google Tag Manager container ID – e.g. "GTM-XXXXXX" */
  gtmId: string | null;
  /** Google Analytics 4 Measurement ID – e.g. "G-XXXXXXXXXX" */
  ga4Id: string | null;
  /** Google Ads Conversion ID – e.g. "AW-XXXXXXXXX" */
  googleAdsId: string | null;
  /** Meta (Facebook) Pixel numeric ID – e.g. "123456789012345" */
  metaPixelId: string | null;
  /**
   * Raw HTML/JS injected into <head> of the Configurator.
   * Admin is a trusted actor – content is NOT sanitized.
   * Enforced max length: 10 000 characters.
   */
  customHeadScripts: string | null;
  /** <title> tag content for the Configurator's main page (max 200 chars) */
  seoTitle: string | null;
  /** <meta name="description"> content for the Configurator (max 500 chars) */
  seoDescription: string | null;
  /** ISO timestamp of the last successful update */
  updatedAt: ISODateString;
  /** UUID of the admin user who last updated these settings. null = system default. */
  updatedBy: UUID | null;
}

/** Default factory – all tracking IDs null, SEO fields pre-filled with sensible SK defaults. */
export const DEFAULT_MARKETING_SETTINGS: MarketingSettings = {
  gtmId:             null,
  ga4Id:             null,
  googleAdsId:       null,
  metaPixelId:       null,
  customHeadScripts: null,
  seoTitle:          "FABRICK – Konfigurujte si fasádu na mieru",
  seoDescription:    "Interaktívny konfigurátor lícových tehál. Vyberte si farbu, štruktúru a väzbu priamo online.",
  updatedAt:         new Date().toISOString(),
  updatedBy:         null,
};

// ─────────────────────────────────────────────────────────────
// Validation helpers (lightweight, no Zod dependency)
// ─────────────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isNonEmptyString(val: unknown): val is string {
  return typeof val === "string" && val.trim().length > 0;
}

export function isValidUUID(val: unknown): val is UUID {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      val
    )
  );
}

export function isValidProductCategory(val: unknown): val is ProductCategory {
  return ["tehla", "vazba", "skara", "other"].includes(val as string);
}

export function isValidProductStatus(val: unknown): val is ProductStatus {
  return ["active", "hidden", "deleted"].includes(val as string);
}

/**
 * Accepts any non-empty string as a valid price level.
 * Open taxonomy – no fixed enum. Values are discovered dynamically
 * via SELECT DISTINCT on the products table.
 */
export function isValidPriceLevel(val: unknown): val is PriceLevel {
  return isNonEmptyString(val);
}

/** Validates the `type` discriminant field for GlobalAttribute records. */
export function isValidAttributeType(val: unknown): val is AttributeType {
  return ["color", "manufacturer", "structure", "format", "priceLevel", "pattern"].includes(
    val as string
  );
}
