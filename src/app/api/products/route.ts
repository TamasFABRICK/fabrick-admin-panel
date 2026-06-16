/**
 * GET  /api/products   – list products (public: active only; auth: all statuses)
 * POST /api/products   – create product (requires: super_admin)
 *
 * ── Integration Layer ─────────────────────────────────────────────────────────
 * Products are sourced from the Configurator API (Source of Truth).
 * The Configurator client handles live fetch with local-snapshot fallback.
 *
 * POST creates a new product in the Configurator via the Integration Layer.
 * On success, the Configurator assigns the canonical product ID.
 *
 * RBAC matrix:
 *   GET     → public (no token) OR any authenticated role
 *   POST    → super_admin ONLY — admin/viewer → 403
 *
 * POST accepts multipart/form-data:
 *   name          string    required
 *   category      string    required  tehla | vazba | skara | other
 *   description   string    optional
 *   color         string    optional
 *   manufacturer  string    optional
 *   structure     string    optional
 *   priceLevel    string    optional  economy | standard | premium | luxury
 *   format        string    optional  JSON: {"width":250,"height":65,"depth":120}
 *   status        string    optional  active | hidden (default: active)
 *   tags          string    optional  JSON array: ["tag1","tag2"]
 *   thumbnail     File      optional  JPEG/PNG/WebP, max 5 MB
 *
 * Text fields in FormData are always strings – numbers/booleans are parsed manually.
 * Texture batch upload is a separate endpoint: POST /api/products/[id]/textures
 */

import { type NextRequest } from "next/server";
import { guardAuth, optionalAuth, authErrorToResponse } from "@/lib/auth/rbac";
import {
  successResponse,
  validationErrorResponse,
  errorResponse,
  corsPreflightResponse,
  paginate,
} from "@/lib/api/response";
import {
  isNonEmptyString,
  isValidProductCategory,
  isValidProductStatus,
  isValidPriceLevel,
  type ProductFormat,
} from "@/lib/db/schema";
import { saveThumbnail }         from "@/lib/upload/fileUtils";
import {
  fetchAllProducts,
  createProduct,
} from "@/lib/configurator/products";
import type { ConfiguratorProduct } from "@/lib/configurator/types";
import prisma from "@/lib/prisma";

export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

// ─────────────────────────────────────────────────────────────
// GET /api/products
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const url = request.nextUrl;
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    // Limit: max 2000 pre interný fetch z brick-generator frontendu, max 100 pre bežné API
    const rawLimit = parseInt(url.searchParams.get("limit") || "15", 10);
    const limit = Math.min(2000, Math.max(1, rawLimit));
    const skip = (page - 1) * limit;

    const activeOnly = url.searchParams.get("activeOnly") === "true";
    const whereCondition = activeOnly ? { isActive: true } : {};

    // Fetch produktov z Prisma DB s explicitným výberom polí
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: whereCondition,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        select: {
          id:              true,
          code:            true,   // ← Unikátny kód priečinka (napr. "A065MIB")
          name:            true,
          manufacturer:    true,
          articleCode:     true,
          formatConfigId:  true,
          formatConfig:    true,
          formatLabel:     true, // Keep for fallback/legacy displays
          dimensions:      true,
          bricksPerM2:     true,
          structure:       true,
          exactPrice:      true,
          priceLevelId:    true,
          priceLevelConfig:true,
          isManualPriceOverride: true,
          dominantnaFarba: true,
          colors:          true,   // JSON string → frontend parsuje JSON.parse()
          colorBreakdown:  true,   // JSON string → frontend parsuje JSON.parse()
          analyzedImages:  true,
          svetlostIndex:   true,
          productType:     true,
          object:          true,
          isActive:        true,
          createdAt:       true,
          updatedAt:       true,
        },
      }),
      prisma.product.count({
        where: whereCondition,
      }),
    ]);

    return successResponse(products, 200, {
      total: totalCount,
      page,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error('Error fetching products from DB:', error);
    return errorResponse("DB_ERROR", "Failed to fetch products", 500);
  }
}


// ─────────────────────────────────────────────────────────────
// POST /api/products  –  super_admin only, multipart/form-data
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  // super_admin only – admin and viewer → 403
  const payload = await guardAuth(request, { roles: ["super_admin"] }).catch(
    authErrorToResponse
  );
  if (payload instanceof Response) return payload;

  // Must be multipart/form-data
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return validationErrorResponse(
      "Content-Type must be multipart/form-data (use FormData for product creation)"
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    return errorResponse(
      "PARSE_ERROR",
      `Failed to parse multipart body: ${(err as Error).message}`,
      400
    );
  }

  // ── Extract text fields ───────────────────────────────────
  const name         = formData.get("name")         as string | null;
  const category     = formData.get("category")     as string | null;
  const description  = formData.get("description")  as string | null;
  const color        = formData.get("color")         as string | null;
  const manufacturer = formData.get("manufacturer")  as string | null;
  const structure    = formData.get("structure")     as string | null;
  const priceLevelId = formData.get("priceLevelId")    as string | null;
  const formatConfigId = formData.get("formatConfigId") as string | null;
  const exactPrice   = formData.get("exactPrice")      as string | null;
  const isManualPriceOverride = formData.get("isManualPriceOverride") === "true";
  const status       = formData.get("status")        as string | null;
  const tagsRaw      = formData.get("tags")          as string | null;
  const formatRaw    = formData.get("format")        as string | null;
  const thumbnail    = formData.get("thumbnail");

  // ── Validate required fields ──────────────────────────────
  if (!isNonEmptyString(name)) {
    return validationErrorResponse("Field 'name' is required");
  }
  if (!isValidProductCategory(category)) {
    return validationErrorResponse(
      "Field 'category' must be one of: tehla, vazba, skara, other"
    );
  }

  // ── Parse JSON compound fields ────────────────────────────
  let tags: string[] = [];
  if (tagsRaw) {
    try {
      const parsed = JSON.parse(tagsRaw);
      tags = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      tags = [];
    }
  }

  const safeFormat: ProductFormat = (() => {
    if (formatRaw) {
      try {
        const f = JSON.parse(formatRaw) as Record<string, unknown>;
        return {
          width:  Number(f.width  ?? 0),
          height: Number(f.height ?? 0),
          depth:  Number(f.depth  ?? 0),
        };
      } catch { /* fall through to default */ }
    }
    return { width: 0, height: 0, depth: 0 };
  })();

  // ── Handle optional thumbnail upload ──────────────────────
  let imageUrl: string | null = null;
  if (thumbnail && thumbnail instanceof File && thumbnail.size > 0) {
    try {
      const saved = await saveThumbnail(thumbnail);
      imageUrl = saved.url;
    } catch (err) {
      return validationErrorResponse((err as Error).message);
    }
  }

  // ── Create product via Configurator Integration Layer ─────
  try {
    const product = await createProduct(
      {
        name:         String(name).trim(),
        category,
        description:  isNonEmptyString(description) ? String(description).trim() : "",
        format:       safeFormat,
        imageUrl,
        textureUrls:  [],
        color:        isNonEmptyString(color)        ? String(color).trim()        : null,
        manufacturer: isNonEmptyString(manufacturer) ? String(manufacturer).trim() : null,
        structure:    isNonEmptyString(structure)    ? String(structure).trim()    : null,
        priceLevelId: isNonEmptyString(priceLevelId) ? priceLevelId : null,
        formatConfigId: isNonEmptyString(formatConfigId) ? formatConfigId : null,
        exactPrice:   exactPrice ? parseFloat(exactPrice) : null,
        isManualPriceOverride,
        status:       isValidProductStatus(status)   ? status                      : "active",
        tags,
      },
      payload.sub
    );

    return successResponse(product, 201);
  } catch (err) {
    return errorResponse(
      "CONFIGURATOR_ERROR",
      `Failed to create product in Configurator: ${(err as Error).message}`,
      502
    );
  }
}
