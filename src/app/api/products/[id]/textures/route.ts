/**
 * GET  /api/products/[id]/textures  – list textures for a product (any auth)
 * POST /api/products/[id]/textures  – batch texture upload (super_admin only)
 * DELETE /api/products/[id]/textures – delete a specific file from bricks dir
 *
 * RBAC matrix:
 *   GET    → any authenticated role (viewer ✅  admin ✅  super_admin ✅)
 *   POST   → super_admin ONLY — admin/viewer → 403
 *   DELETE → write role (admin ✅  super_admin ✅)
 *
 * POST accepts multipart/form-data:
 *   textureImages[]  – 1 to 250 File objects (JPEG/PNG/WebP, max 10 MB each)
 *
 * DELETE accepts JSON body:
 *   { filename: string }  – the exact filename to delete from bricks/[code]/
 *
 * ─── Zóna B File Manager (GET enhanced, DELETE new) ───
 *
 * GET now also reads the physical bricks directory from BRICKS_PUBLIC_DIR
 * and returns the full file listing with sizes, types, and preview URLs.
 *
 * Env vars (in .env.local):
 *   BRICKS_PUBLIC_DIR  – absolute path to brick-generator/public/bricks
 *   BRICKS_SERVE_URL   – public URL prefix (e.g. http://localhost:3000/bricks)
 *
 * Security:
 *   - product.code validated: only alphanumeric + _ - and space
 *   - filename (DELETE) must not contain "/" or ".."
 *   - Only image extensions (.webp, .png, .jpg, .jpeg) are listed/deleted
 *   - resolved path must be inside BRICKS_PUBLIC_DIR/[code]
 */

import { type NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db/store";
import { guardAuth, optionalAuth, authErrorToResponse } from "@/lib/auth/rbac";
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
  errorResponse,
  corsPreflightResponse,
} from "@/lib/api/response";
import { streamTextureUpload } from "@/lib/upload/textureStreamer";
import prisma from "@/lib/prisma";

// Allow up to 5 minutes for large batch uploads
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// ─── Zóna B File Manager Config ───────────────────────────────

const BRICKS_PUBLIC_DIR =
  process.env.BRICKS_PUBLIC_DIR ??
  path.join(process.cwd(), "..", "brick-generator", "public", "bricks");

const BRICKS_SERVE_URL =
  process.env.BRICKS_SERVE_URL ?? "http://localhost:3000/bricks";

/** Allowed image extensions for listing and deletion */
const IMAGE_EXTS = new Set([".webp", ".png", ".jpg", ".jpeg"]);

/** Filenames that are thumbnails (flagged in UI, need double-confirm on delete) */
const THUMB_NAMES = new Set(["thumb.webp", "thumb.png", "thumb.jpg", "thumb.jpeg"]);

/** Safe code pattern – prevents directory traversal */
const SAFE_CODE_RE = /^[A-Za-z0-9_\- ]+$/;

/** Safe filename: no slashes, must have extension */
const SAFE_FILENAME_RE = /^[^/\\]+\.[A-Za-z0-9]+$/;

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─────────────────────────────────────────────────────────────

export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

// ─────────────────────────────────────────────────────────────
// GET /api/products/[id]/textures
// Returns physical file listing from bricks directory + DB texture URLs
// ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  // Any authenticated role can read textures
  const auth = await optionalAuth(request);
  if (!auth) {
    return errorResponse("UNAUTHORIZED", "Authentication required", 401);
  }

  const { id } = await params;

  // Try Prisma first (primary DB)
  let code: string | null = null;
  try {
    const prismaProduct = await prisma.product.findUnique({
      where: { id },
      select: { id: true, code: true },
    });
    if (prismaProduct) {
      code = prismaProduct.code ?? null;
    }
  } catch {
    // Prisma query failed – fall through to db.json fallback
  }

  // Fallback to db.json store for legacy products
  const storeProduct = code === null ? db.products.findById(id) : null;
  if (!code && storeProduct) {
    // db.json products don't have code field in same schema; use textureUrls fallback
    return successResponse({
      productId: id,
      code: null,
      files: [],
      totalFiles: 0,
      urls: storeProduct.textureUrls ?? [],
      message: "Legacy product (no code) – returning DB texture URLs only",
    });
  }

  if (!code && !storeProduct) {
    return notFoundResponse("Product");
  }

  if (!code) {
    return successResponse({
      productId: id,
      code: null,
      files: [],
      totalFiles: 0,
      urls: [],
      message: "Product has no code assigned – cannot locate texture directory",
    });
  }

  if (!SAFE_CODE_RE.test(code)) {
    return validationErrorResponse("Product code contains unsafe characters");
  }

  const dirPath = path.join(BRICKS_PUBLIC_DIR, code);

  if (!fs.existsSync(dirPath)) {
    return successResponse({
      productId: id,
      code,
      dirPath: `bricks/${code}`,
      files: [],
      totalFiles: 0,
      urls: [],
      message: `Texture directory not found: bricks/${code}`,
    });
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    console.error("[textures GET] Failed to read directory:", err);
    return errorResponse("FS_ERROR", "Failed to read texture directory", 500);
  }

  const files = entries
    .filter((e) => e.isFile() && IMAGE_EXTS.has(path.extname(e.name).toLowerCase()))
    .map((e) => {
      const filePath = path.join(dirPath, e.name);
      let sizeBytes = 0;
      try { sizeBytes = fs.statSync(filePath).size; } catch { /* ignore */ }
      const ext  = path.extname(e.name).toLowerCase().slice(1);
      const isThumb = THUMB_NAMES.has(e.name.toLowerCase());
      return {
        name: e.name,
        sizeBytes,
        sizeLabel: sizeLabel(sizeBytes),
        type: ext,
        isThumb,
        url: `${BRICKS_SERVE_URL}/${encodeURIComponent(code!)}/${encodeURIComponent(e.name)}`,
      };
    })
    .sort((a, b) => {
      // Thumbnails first, then numeric-aware alphabetical
      if (a.isThumb && !b.isThumb) return -1;
      if (!a.isThumb && b.isThumb) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

  return successResponse({
    productId: id,
    code,
    dirPath: `bricks/${code}`,
    files,
    totalFiles: files.length,
  });
}

// ─────────────────────────────────────────────────────────────
// POST /api/products/[id]/textures  – streaming batch upload
// ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  // super_admin only
  const payload = await guardAuth(request, { roles: ["super_admin"] }).catch(
    authErrorToResponse
  );
  if (payload instanceof Response) return payload;

  const { id } = await params;
  const product = db.products.findById(id);
  if (!product || product.status === "deleted") {
    return notFoundResponse("Product");
  }

  // ?replace=false to append; default is replace (clean slate)
  const replaceExisting =
    request.nextUrl.searchParams.get("replace") !== "false";

  // Content-Type check – must be multipart
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return validationErrorResponse(
      "Content-Type must be multipart/form-data with textureImages[] files"
    );
  }

  // Guard against empty body
  if (!request.body) {
    return validationErrorResponse("Request body is empty");
  }

  let result: Awaited<ReturnType<typeof streamTextureUpload>>;
  try {
    result = await streamTextureUpload(request, id, replaceExisting);
  } catch (err) {
    return errorResponse(
      "UPLOAD_ERROR",
      `Streaming upload failed: ${(err as Error).message}`,
      500
    );
  }

  // Reject if no files were successfully saved
  if (result.count === 0 && result.errors.length === 0) {
    return validationErrorResponse(
      "No texture files found in request. Send files under the 'textureImages[]' field."
    );
  }

  // Update product textureUrls in DB
  const newUrls = replaceExisting
    ? result.saved.map((f) => f.url)
    : [...product.textureUrls, ...result.saved.map((f) => f.url)];

  db.products.update(id, { textureUrls: newUrls });

  return successResponse(
    {
      saved:      result.saved,
      errors:     result.errors,
      totalBytes: result.totalBytes,
      count:      result.count,
    },
    result.errors.length > 0 ? 207 : 200
  );
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/products/[id]/textures
// Deletes a single physical file from BRICKS_PUBLIC_DIR/[code]/[filename]
// Body: { filename: string }
// ─────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  // Write role required (admin / super_admin)
  const auth = await guardAuth(request, { requireWrite: true }).catch(authErrorToResponse);
  if (auth instanceof Response) return auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON: { filename: string }");
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const filename = raw.filename as string | undefined;

  if (!filename || typeof filename !== "string") {
    return validationErrorResponse("Field 'filename' is required");
  }

  // Path traversal protection
  if (!SAFE_FILENAME_RE.test(filename) || filename.includes("..")) {
    return validationErrorResponse("Invalid filename – path traversal detected");
  }

  // Only image extensions allowed
  if (!IMAGE_EXTS.has(path.extname(filename).toLowerCase())) {
    return validationErrorResponse(
      "Only image files (.webp, .png, .jpg, .jpeg) can be deleted"
    );
  }

  // Fetch product code from Prisma
  let code: string | null = null;
  try {
    const prismaProduct = await prisma.product.findUnique({
      where: { id },
      select: { id: true, code: true },
    });
    if (prismaProduct) code = prismaProduct.code ?? null;
  } catch {
    return errorResponse("DB_ERROR", "Failed to fetch product", 500);
  }

  if (!code) {
    return validationErrorResponse("Product has no code – cannot locate texture directory");
  }

  if (!SAFE_CODE_RE.test(code)) {
    return validationErrorResponse("Product code contains unsafe characters");
  }

  const filePath   = path.join(BRICKS_PUBLIC_DIR, code, filename);
  const resolvedFile = path.resolve(filePath);
  const resolvedDir  = path.resolve(path.join(BRICKS_PUBLIC_DIR, code));

  if (!fs.existsSync(filePath)) {
    return notFoundResponse(`File '${filename}'`);
  }

  // Extra safety: ensure resolved path stays within the product's directory
  if (!resolvedFile.startsWith(resolvedDir + path.sep)) {
    return validationErrorResponse("Path traversal detected – operation refused");
  }

  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    console.error("[textures DELETE] Failed to delete file:", err);
    return errorResponse("FS_ERROR", `Failed to delete file '${filename}'`, 500);
  }

  return successResponse({ deleted: true, filename, code });
}
