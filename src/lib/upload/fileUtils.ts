/**
 * FABRICK Upload Module – File Utilities
 * ───────────────────────────────────────
 * Synchronous helpers for directory management, filename generation,
 * MIME type validation, and in-memory thumbnail persistence.
 *
 * For thumbnail (single file, max 5 MB): use saveThumbnail() which
 * reads the Web API File object into a Buffer – safe at this size.
 *
 * For textures (batch, large): use textureStreamer.ts instead.
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_THUMBNAIL_BYTES,
  thumbnailAbsDir,
  thumbnailUrl,
} from "./constants";

// ─────────────────────────────────────────────────────────────
// Directory helpers
// ─────────────────────────────────────────────────────────────

/**
 * Ensures a directory (and all parents) exist.
 * No-op if the directory already exists.
 */
export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Atomically replaces a directory with a fresh empty one.
 * Deletes the entire tree if it exists, then recreates it.
 */
export function cleanDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
  fs.mkdirSync(dirPath, { recursive: true });
}

// ─────────────────────────────────────────────────────────────
// Filename generation
// ─────────────────────────────────────────────────────────────

/**
 * Generates a UUID-based filename, preserving the original extension.
 * Falls back to ".jpg" if no extension is detected.
 */
export function generateFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  return `${randomUUID()}${ext}`;
}

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

export function isAllowedImageType(mimeType: string): mimeType is (typeof ALLOWED_IMAGE_TYPES)[number] {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimeType);
}

// ─────────────────────────────────────────────────────────────
// Thumbnail persistence (in-memory buffer – safe for max 5 MB)
// ─────────────────────────────────────────────────────────────

export interface SavedFile {
  /** Relative URL for DB storage, e.g. /uploads/products/thumbnails/<uuid>.jpg */
  url: string;
  /** UUID-based filename on disk */
  filename: string;
  /** File size in bytes */
  sizeBytes: number;
}

/**
 * Saves a thumbnail File (from Web API FormData) to the thumbnails directory.
 *
 * @throws {Error} if MIME type is not allowed or file exceeds 5 MB
 */
export async function saveThumbnail(file: File): Promise<SavedFile> {
  if (!isAllowedImageType(file.type)) {
    throw new Error(
      `Invalid thumbnail type: "${file.type}". Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`
    );
  }
  if (file.size > MAX_THUMBNAIL_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(
      `Thumbnail too large: ${mb} MB. Maximum allowed: 5 MB`
    );
  }

  const filename = generateFilename(file.name);
  const dir = thumbnailAbsDir();
  ensureDir(dir);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);

  return {
    url: thumbnailUrl(filename),
    filename,
    sizeBytes: file.size,
  };
}

// ─────────────────────────────────────────────────────────────
// Cleanup helpers
// ─────────────────────────────────────────────────────────────

/**
 * Deletes a single file by its relative public URL.
 * Silently ignores missing files (idempotent).
 */
export function deleteFileByUrl(relativeUrl: string | null | undefined): void {
  if (!relativeUrl) return;
  const absPath = path.join(process.cwd(), "public", relativeUrl);
  try {
    fs.unlinkSync(absPath);
  } catch {
    // File may not exist – silently ignore
  }
}
