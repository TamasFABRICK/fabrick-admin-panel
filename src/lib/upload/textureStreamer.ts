/**
 * FABRICK Upload Module – Texture Upload
 * ─────────────────────────────────────────────────
 * Processes a multipart/form-data request containing 1-250 texture images
 * using the native Web API request.formData(), writing each file to disk.
 *
 * Implementation note:
 *   Uses request.formData() (Next.js App Router native) for reliability.
 *   Busboy + Next.js App Router Web Streams interop has known dev-mode issues.
 *   formData() is the documented approach per Next.js route.md.
 *
 * Accepted field names (any of these works):
 *   textureImages[], textureImages, textures[], textures, files[], files
 *
 * Memory profile:
 *   Files are processed sequentially. Peak RAM = 1 file buffer (max 10 MB).
 */

import fs from "node:fs";
import path from "node:path";
import type { NextRequest } from "next/server";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_TEXTURE_BYTES,
  MAX_TEXTURE_COUNT,
  textureAbsDir,
  textureUrl,
} from "./constants";
import { cleanDir, ensureDir, generateFilename, isAllowedImageType } from "./fileUtils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SavedTexture {
  /** Relative URL for DB storage, e.g. /uploads/products/<id>/textures/<uuid>.jpg */
  url: string;
  filename: string;
  originalName: string;
  sizeBytes: number;
}

export interface TextureUploadError {
  originalName: string;
  reason: string;
}

export interface TextureStreamResult {
  saved: SavedTexture[];
  errors: TextureUploadError[];
  totalBytes: number;
  count: number;
}

// Field names accepted for texture files (frontend convenience)
const TEXTURE_FIELD_NAMES = new Set([
  "textureImages[]", "textureImages",
  "textures[]",      "textures",
  "files[]",         "files",
]);

// ─────────────────────────────────────────────────────────────
// Core upload function
// ─────────────────────────────────────────────────────────────

/**
 * Parses a multipart texture upload and saves files to disk.
 *
 * @param request         - Incoming NextRequest with multipart body
 * @param productId       - Product UUID (used as directory name)
 * @param replaceExisting - If true, wipes /textures/ dir before writing
 */
export async function streamTextureUpload(
  request: NextRequest,
  productId: string,
  replaceExisting: boolean
): Promise<TextureStreamResult> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    throw new Error("Content-Type must be multipart/form-data");
  }

  // Parse with native Web API – reliable in Next.js App Router
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    throw new Error(`Failed to parse multipart body: ${(err as Error).message}`);
  }

  // Collect all File entries matching any accepted field name
  const files: File[] = [];
  for (const [key, value] of formData.entries()) {
    if (value instanceof File && TEXTURE_FIELD_NAMES.has(key)) {
      files.push(value);
    }
  }

  const saved: SavedTexture[] = [];
  const errors: TextureUploadError[] = [];
  let totalBytes = 0;

  if (files.length === 0) {
    return { saved, errors, totalBytes, count: 0 };
  }

  // Prepare directory – clean old textures if replacing
  const absDir = textureAbsDir(productId);
  if (replaceExisting) {
    cleanDir(absDir);
  } else {
    ensureDir(absDir);
  }

  // Enforce per-batch file count limit
  const limit = Math.min(files.length, MAX_TEXTURE_COUNT);
  if (files.length > MAX_TEXTURE_COUNT) {
    errors.push({
      originalName: "(batch limit)",
      reason: `Maximum ${MAX_TEXTURE_COUNT} files per upload. ${files.length - MAX_TEXTURE_COUNT} files were discarded.`,
    });
  }

  // Process files sequentially (peak RAM = 1 file buffer at a time)
  for (let i = 0; i < limit; i++) {
    const file = files[i];
    const originalName = file.name || `texture-${i}.jpg`;

    if (!isAllowedImageType(file.type)) {
      errors.push({
        originalName,
        reason: `Invalid type "${file.type}". Allowed: ${ALLOWED_IMAGE_TYPES.join(", ")}`,
      });
      continue;
    }

    if (file.size > MAX_TEXTURE_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      const maxMb = (MAX_TEXTURE_BYTES / 1024 / 1024).toFixed(0);
      errors.push({ originalName, reason: `File too large: ${mb} MB. Max: ${maxMb} MB` });
      continue;
    }

    try {
      const newFilename = generateFilename(originalName);
      const filePath = path.join(absDir, newFilename);
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, buffer);

      totalBytes += file.size;
      saved.push({
        url: textureUrl(productId, newFilename),
        filename: newFilename,
        originalName,
        sizeBytes: file.size,
      });
    } catch (err) {
      errors.push({ originalName, reason: `Write error: ${(err as Error).message}` });
    }
  }

  return { saved, errors, totalBytes, count: saved.length };
}
