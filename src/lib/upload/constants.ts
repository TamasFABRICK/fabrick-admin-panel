/**
 * FABRICK Upload Module – Constants & URL Helpers
 * ────────────────────────────────────────────────
 * Single source of truth for all upload-related paths and limits.
 *
 * Absolute paths (for Node.js fs operations):
 *   thumbnailAbsDir()         → <cwd>/public/uploads/products/thumbnails/
 *   textureAbsDir(productId)  → <cwd>/public/uploads/products/<id>/textures/
 *
 * Relative URLs (for DB storage + HTTP access via Next.js public/):
 *   thumbnailUrl(filename)              → /uploads/products/thumbnails/<uuid>.ext
 *   textureUrl(productId, filename)     → /uploads/products/<id>/textures/<uuid>.ext
 */

import path from "node:path";

// ─────────────────────────────────────────────────────────────
// Allowed MIME types
// ─────────────────────────────────────────────────────────────

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

// ─────────────────────────────────────────────────────────────
// Size limits
// ─────────────────────────────────────────────────────────────

/** 5 MB – maximum thumbnail file size */
export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

/** 10 MB – maximum size per individual texture */
export const MAX_TEXTURE_BYTES = 10 * 1024 * 1024;

/** Maximum number of texture files accepted in a single batch upload */
export const MAX_TEXTURE_COUNT = 250;

// ─────────────────────────────────────────────────────────────
// Absolute directory paths (Node.js fs)
// ─────────────────────────────────────────────────────────────

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "products");

/**
 * Absolute path to the shared thumbnail directory.
 * All product thumbnails are stored flat here (one UUID per product).
 */
export function thumbnailAbsDir(): string {
  return path.join(UPLOAD_ROOT, "thumbnails");
}

/**
 * Absolute path to the per-product texture directory.
 * Each product gets its own isolated folder.
 */
export function textureAbsDir(productId: string): string {
  return path.join(UPLOAD_ROOT, productId, "textures");
}

// ─────────────────────────────────────────────────────────────
// Relative URL builders (stored in DB, served by Next.js static)
// ─────────────────────────────────────────────────────────────

export function thumbnailUrl(filename: string): string {
  return `/uploads/products/thumbnails/${filename}`;
}

export function textureUrl(productId: string, filename: string): string {
  return `/uploads/products/${productId}/textures/${filename}`;
}
