/**
 * GET  /api/attributes  – Vracia číselníky zoskupené podľa typu.
 *                         Zdroj: lokálna Prisma DB (dynamicky extrahované unikátne hodnoty).
 *                         Fallback: db.attributes (MDM store z db.json).
 *
 * POST /api/attributes  – Write roles (admin, super_admin). Vytvorí atribút v lokálnom MDM.
 *
 * ── Architektúra ─────────────────────────────────────────────────────────────
 * Admin Panel je Single Source of Truth. GET číta unikátne hodnoty PRIAMO
 * z Prisma (tabuľka Product) – žiadne volania externého Konfigurátora.
 * POST zapisuje do lokálneho db.json (MDM vrstva pre ručne pridané atribúty).
 */

import { type NextRequest } from "next/server";
import {
  successResponse,
  createdResponse,
  validationErrorResponse,
  conflictResponse,
  errorResponse,
} from "@/lib/api/response";
import {
  guardAuth,
  authErrorToResponse,
} from "@/lib/auth/rbac";
import {
  isNonEmptyString,
  isValidAttributeType,
} from "@/lib/db/schema";
import { db } from "@/lib/db/store";
import { isDuplicateAttribute } from "@/lib/db/attributes";
import type { AttributeType } from "@/lib/db/schema";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ─── Helper: unikátne non-null stringy z poľa ────────────────────────────────
function uniq(arr: (string | null | undefined)[]): string[] {
  return Array.from(new Set(arr.filter(Boolean) as string[])).sort();
}

// toOptions removed, we now preserve MDM object shape directly

// ─────────────────────────────────────────────────────────────
// GET /api/attributes
// Číta LOKÁLNE z Prisma DB (unikátne hodnoty z produktov)
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const typeFilter      = searchParams.get("type");
  const includeInactive = searchParams.get("includeInactive") === "true";

  // includeInactive vyžaduje write rolu
  if (includeInactive) {
    const payload = await guardAuth(request, { requireWrite: true }).catch(
      authErrorToResponse
    );
    if (payload instanceof Response) return payload;
  }

  // Validácia type filtra
  if (typeFilter !== null && !isValidAttributeType(typeFilter)) {
    return validationErrorResponse(
      `Invalid 'type' query param. Must be one of: color, manufacturer, structure, format, priceLevel, pattern`
    );
  }


  try {
    // ── Krok 1: Načítaj unikátne hodnoty z Prisma produktov a pravidlá ─────
    const products = await prisma.product.findMany({
      select: {
        dominantnaFarba: true,
        manufacturer:    true,
        structure:       true,
      },
    });

    const priceLevelConfigs = await prisma.priceLevelConfig.findMany({
      orderBy: { minPrice: 'asc' }
    });

    const formatConfigs = await prisma.formatConfig.findMany({
      orderBy: { name: 'asc' }
    });

    const patternConfigs = await prisma.patternConfig.findMany({
      orderBy: { name: 'asc' }
    });

    const prismaColors        = uniq(products.map(p => p.dominantnaFarba));
    const prismaManufacturers = uniq(products.map(p => p.manufacturer));
    const prismaStructures    = uniq(products.map(p => p.structure));

    // ── Krok 2: Doplň MDM atribúty z db.json a vytvor finálny zoznam ───────
    const mdmAttributes = db.attributes.findAll().filter(a => a.active);

    function buildOptions(prismaValues: string[], attrType: AttributeType, alphaSort = true) {
      const mdmForType = mdmAttributes.filter(a => a.type === attrType);
      
      const result = [...mdmForType.map(a => ({
        id: a.id,
        label: a.label,
        value: a.label,
        meta: a.meta,
        sortOrder: a.sortOrder,
        active: a.active
      }))];

      const mdmLabels = new Set(mdmForType.map(a => a.label.toLowerCase()));
      let dynamicSortOrder = result.length > 0 ? Math.max(...result.map(r => r.sortOrder)) + 1 : 0;

      for (const val of prismaValues) {
        if (!mdmLabels.has(val.toLowerCase())) {
          result.push({
            id: val, // Použijeme samotnú hodnotu ako ID pre dynamické záznamy
            label: val,
            value: val,
            meta: null,
            sortOrder: dynamicSortOrder++,
            active: true
          });
        }
      }

      return result.sort((a, b) => {
        if (alphaSort) return a.label.localeCompare(b.label);
        return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);
      });
    }

    const priceLevelOptions = priceLevelConfigs.map((c, i) => ({
      id: c.id,
      label: c.name,
      value: c.id,
      meta: JSON.stringify({ minPrice: c.minPrice, maxPrice: c.maxPrice, currency: c.currency }),
      sortOrder: i,
      active: true
    }));

    const formatOptions = formatConfigs.map((c, i) => ({
      id: c.id,
      label: c.name,
      value: c.id,
      meta: JSON.stringify({ width: c.width, height: c.height, thickness: c.thickness, allowedPatterns: c.allowedPatterns }),
      sortOrder: i,
      active: true
    }));

    const patternOptions = patternConfigs.map((c, i) => ({
      id: c.id,
      label: c.name,
      value: c.code,
      meta: null,
      sortOrder: i,
      active: c.isActive
    }));

    const grouped = {
      colors:        buildOptions(prismaColors,        "color"),
      manufacturers: buildOptions(prismaManufacturers, "manufacturer"),
      structures:    buildOptions(prismaStructures,    "structure"),
      formats:       formatOptions,
      priceLevels:   priceLevelOptions,
      patterns:      patternOptions,
    };

    // Type filter – vráť len jednu skupinu
    if (typeFilter) {
      const key = (
        typeFilter === "priceLevel"   ? "priceLevels"   :
        typeFilter === "color"        ? "colors"         :
        typeFilter === "manufacturer" ? "manufacturers"  :
        typeFilter === "structure"    ? "structures"     :
        typeFilter === "pattern"      ? "patterns"       :
        "formats"
      ) as keyof typeof grouped;

      const items = grouped[key];
      return successResponse({ type: typeFilter, items, total: items.length });
    }

    // Vráť všetky skupiny
    return successResponse({
      ...grouped,
      _meta: {
        colors:        grouped.colors.length,
        manufacturers: grouped.manufacturers.length,
        structures:    grouped.structures.length,
        formats:       grouped.formats.length,
        priceLevels:   grouped.priceLevels.length,
        patterns:      grouped.patterns.length,
        total:
          grouped.colors.length +
          grouped.manufacturers.length +
          grouped.structures.length +
          grouped.formats.length +
          grouped.priceLevels.length +
          grouped.patterns.length,
        source: "prisma-local",
      },
    });
  } catch (error) {
    console.error("[/api/attributes GET] Prisma error:", error);

    // ── Fallback: db.json MDM atribúty ak Prisma zlyháva ───────────────────
    const { getGroupedAttributes, getAllGroupedAttributes } = await import("@/lib/db/attributes");
    const grouped = includeInactive ? getAllGroupedAttributes() : getGroupedAttributes();

    return successResponse({
      ...grouped,
      _meta: {
        colors:        grouped.colors.length,
        manufacturers: grouped.manufacturers.length,
        structures:    grouped.structures.length,
        formats:       grouped.formats.length,
        priceLevels:   grouped.priceLevels.length,
        patterns:      grouped.patterns ? grouped.patterns.length : 0,
        total:
          grouped.colors.length +
          grouped.manufacturers.length +
          grouped.structures.length +
          grouped.formats.length +
          grouped.priceLevels.length +
          (grouped.patterns ? grouped.patterns.length : 0),
        source: "db-json-fallback",
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/attributes
// Zapisuje do lokálneho MDM (db.json) – žiadny Konfigurátor
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  const authPayload = await guardAuth(request, { requireWrite: true }).catch(
    authErrorToResponse
  );
  if (authPayload instanceof Response) return authPayload;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const { type, label, meta, sortOrder } = raw;

  // ── Validácia ─────────────────────────────────────────────
  if (!isValidAttributeType(type)) {
    return validationErrorResponse(
      "Field 'type' is required and must be one of: color, manufacturer, structure, format, priceLevel"
    );
  }
  if (!isNonEmptyString(label)) {
    return validationErrorResponse("Field 'label' is required and must be a non-empty string");
  }

  const safeLabel     = String(label).trim();
  const safeMeta      = isNonEmptyString(meta) ? String(meta).trim() : null;
  const safeSortOrder = typeof sortOrder === "number" && Number.isFinite(sortOrder)
    ? Math.round(sortOrder)
    : db.attributes.findAll().length;

  if (type === 'priceLevel') {
    const { minPrice, maxPrice, currency = 'EUR' } = raw;
    
    const parsedMinPrice = typeof minPrice === 'number' ? minPrice : parseFloat(String(minPrice));
    const parsedMaxPrice = typeof maxPrice === 'number' ? maxPrice : parseFloat(String(maxPrice));

    if (isNaN(parsedMinPrice) || isNaN(parsedMaxPrice)) {
      return validationErrorResponse("Fields 'minPrice' and 'maxPrice' are required and must be valid numbers for priceLevel.");
    }

    try {
      const priceLevel = await prisma.priceLevelConfig.create({
        data: {
          name: safeLabel,
          minPrice: parsedMinPrice,
          maxPrice: parsedMaxPrice,
          currency: String(currency).trim()
        }
      });
      return createdResponse(priceLevel);
    } catch (err) {
      return errorResponse(
        "DB_ERROR",
        `Failed to create priceLevel: ${(err as Error).message}`,
        500
      );
    }
  }

  if (type === 'format') {
    const { width, height, thickness } = raw;
    
    const parsedWidth = typeof width === 'number' ? width : parseFloat(String(width));
    const parsedHeight = typeof height === 'number' ? height : parseFloat(String(height));
    const parsedThickness = thickness != null && thickness !== "" ? (typeof thickness === 'number' ? thickness : parseFloat(String(thickness))) : null;

    if (isNaN(parsedWidth) || isNaN(parsedHeight)) {
      return validationErrorResponse("Fields 'width' and 'height' are required and must be valid numbers for format.");
    }

    try {
      const formatConfig = await prisma.formatConfig.create({
        data: {
          name: safeLabel,
          width: parsedWidth,
          height: parsedHeight,
          thickness: parsedThickness
        }
      });
      return createdResponse(formatConfig);
    } catch (err) {
      return errorResponse(
        "DB_ERROR",
        `Failed to create format: ${(err as Error).message}`,
        500
      );
    }
  }

  // ── Kontrola duplikátov ───────────────────────────────────
  if (isDuplicateAttribute(type as AttributeType, safeLabel)) {
    return conflictResponse(
      `Attribute with type '${type}' and label '${safeLabel}' already exists`
    );
  }

  // ── Zápis do lokálneho MDM ────────────────────────────────
  try {
    const allAttrs = db.attributes.findAll();
    const maxOrder = allAttrs.length > 0
      ? Math.max(...allAttrs.map(a => a.sortOrder))
      : 0;

    const attribute = db.attributes.create({
      type:      type as AttributeType,
      label:     safeLabel,
      meta:      safeMeta,
      sortOrder: safeSortOrder ?? maxOrder + 1,
      active:    true,
      createdBy: authPayload.sub,
    });
    return createdResponse(attribute);
  } catch (err) {
    return errorResponse(
      "DB_ERROR",
      `Failed to create attribute: ${(err as Error).message}`,
      500
    );
  }
}
