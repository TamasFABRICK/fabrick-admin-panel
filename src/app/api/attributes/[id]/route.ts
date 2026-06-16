/**
 * GET    /api/attributes/[id]  – Public. Returns a single attribute (including inactive).
 * PATCH  /api/attributes/[id]  – Write roles. Update label, meta, sortOrder, or active flag.
 * DELETE /api/attributes/[id]  – Write roles. Hard delete (MDM-managed, not product-coupled).
 */

import { type NextRequest } from "next/server";
import {
  successResponse,
  validationErrorResponse,
  notFoundResponse,
  conflictResponse,
} from "@/lib/api/response";
import { guardAuth, authErrorToResponse } from "@/lib/auth/rbac";
import { db } from "@/lib/db/store";
import { isNonEmptyString } from "@/lib/db/schema";
import { isDuplicateAttribute } from "@/lib/db/attributes";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────
// GET /api/attributes/[id]
// ─────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const attribute = db.attributes.findById(id);
  if (!attribute) return notFoundResponse("Attribute");
  return successResponse(attribute);
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/attributes/[id]
// ─────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const payload = await guardAuth(request, { requireWrite: true }).catch(
    authErrorToResponse
  );
  if (payload instanceof Response) return payload;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  const raw   = (body ?? {}) as Record<string, unknown>;

  try {
    const priceLevel = await prisma.priceLevelConfig.findUnique({ where: { id } });
    if (priceLevel) {
      const { label, minPrice, maxPrice, currency } = raw;
      const updateData: any = {};
      
      if (label !== undefined && isNonEmptyString(label)) updateData.name = String(label).trim();
      
      if (minPrice !== undefined) {
        const parsedMinPrice = typeof minPrice === 'number' ? minPrice : parseFloat(String(minPrice));
        if (!isNaN(parsedMinPrice)) updateData.minPrice = parsedMinPrice;
      }
      
      if (maxPrice !== undefined) {
        const parsedMaxPrice = typeof maxPrice === 'number' ? maxPrice : parseFloat(String(maxPrice));
        if (!isNaN(parsedMaxPrice)) updateData.maxPrice = parsedMaxPrice;
      }
      
      if (currency !== undefined) updateData.currency = String(currency).trim();

      const updated = await prisma.priceLevelConfig.update({
        where: { id },
        data: updateData
      });
      return successResponse(updated);
    }

    const patternConfig = await prisma.patternConfig.findUnique({ where: { id } });
    if (patternConfig) {
      const { active } = raw;
      if (active !== undefined && typeof active === 'boolean') {
        const updated = await prisma.patternConfig.update({
          where: { id },
          data: { isActive: active }
        });
        return successResponse(updated);
      }
    }

    const formatConfig = await prisma.formatConfig.findUnique({ where: { id } });
    if (formatConfig) {
      const { label, width, height, thickness, allowedPatterns } = raw;
      const updateData: any = {};
      
      if (label !== undefined && isNonEmptyString(label)) updateData.name = String(label).trim();
      
      if (width !== undefined) {
        const parsedWidth = typeof width === 'number' ? width : parseFloat(String(width));
        if (!isNaN(parsedWidth)) updateData.width = parsedWidth;
      }
      
      if (height !== undefined) {
        const parsedHeight = typeof height === 'number' ? height : parseFloat(String(height));
        if (!isNaN(parsedHeight)) updateData.height = parsedHeight;
      }
      
      if (thickness !== undefined) {
        if (thickness === null || thickness === "") {
          updateData.thickness = null;
        } else {
          const parsedThickness = typeof thickness === 'number' ? thickness : parseFloat(String(thickness));
          if (!isNaN(parsedThickness)) updateData.thickness = parsedThickness;
        }
      }

      if (allowedPatterns !== undefined) {
        if (typeof allowedPatterns === 'string') {
          updateData.allowedPatterns = allowedPatterns;
        } else {
          updateData.allowedPatterns = JSON.stringify(allowedPatterns);
        }
      }

      const updated = await prisma.formatConfig.update({
        where: { id },
        data: updateData
      });
      return successResponse(updated);
    }
  } catch (error) {
    // Ignore UUID errors etc. and proceed to MDM
  }

  const existing = db.attributes.findById(id);
  if (!existing) {
    return validationErrorResponse("This attribute is dynamically extracted from products and cannot be edited directly. Add it manually to override.");
  }

  const patch: Partial<typeof existing> = {};

  // ── label ──────────────────────────────────────────────────
  if ("label" in raw) {
    if (!isNonEmptyString(raw.label)) {
      return validationErrorResponse("Field 'label' must be a non-empty string");
    }
    const newLabel = String(raw.label).trim();
    // Duplicate check: same type + new label (excluding self)
    if (isDuplicateAttribute(existing.type, newLabel, id)) {
      return conflictResponse(
        `Attribute with type '${existing.type}' and label '${newLabel}' already exists`
      );
    }
    patch.label = newLabel;
  }

  // ── meta ────────────────────────────────────────────────────
  if ("meta" in raw) {
    patch.meta = isNonEmptyString(raw.meta) ? String(raw.meta).trim() : null;
  }

  // ── sortOrder ───────────────────────────────────────────────
  if ("sortOrder" in raw) {
    const n = Number(raw.sortOrder);
    if (!Number.isFinite(n)) {
      return validationErrorResponse("Field 'sortOrder' must be a finite number");
    }
    patch.sortOrder = Math.round(n);
  }

  // ── active ──────────────────────────────────────────────────
  if ("active" in raw) {
    if (typeof raw.active !== "boolean") {
      return validationErrorResponse("Field 'active' must be a boolean");
    }
    patch.active = raw.active;
  }

  if (Object.keys(patch).length === 0) {
    return validationErrorResponse(
      "Request body must contain at least one updatable field: label, meta, sortOrder, active"
    );
  }

  const updated = db.attributes.update(id, patch);
  if (!updated) return notFoundResponse("Attribute");

  return successResponse(updated);
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/attributes/[id]
// ─────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const payload = await guardAuth(request, { requireWrite: true }).catch(
    authErrorToResponse
  );
  if (payload instanceof Response) return payload;

  const { id } = await params;

  try {
    const priceLevel = await prisma.priceLevelConfig.findUnique({
      where: { id }
    });

    if (priceLevel) {
      const count = await prisma.product.count({
        where: { priceLevelId: id }
      });

      if (count > 0) {
        return validationErrorResponse("Tento atribút je priradený k existujúcim produktom a nedá sa vymazať. Najprv zmeňte hodnoty pri príslušných produktoch.");
      }

      await prisma.priceLevelConfig.delete({
        where: { id }
      });

      return successResponse({
        deleted: true,
        id,
        type: "priceLevel",
        label: priceLevel.name,
      });
    }

    // Skúsime či to nie je formát
    const formatConfig = await prisma.formatConfig.findUnique({
      where: { id }
    });

    if (formatConfig) {
      const count = await prisma.product.count({
        where: { formatConfigId: id }
      });

      if (count > 0) {
        return validationErrorResponse("Tento formát je priradený k existujúcim produktom a nedá sa vymazať. Najprv zmeňte hodnoty pri príslušných produktoch.");
      }

      await prisma.formatConfig.delete({
        where: { id }
      });

      return successResponse({
        deleted: true,
        id,
        type: "format",
        label: formatConfig.name,
      });
    }
  } catch (error) {
    // Ignorujeme chyby (napr. neplatný UUID formát) a pokračujeme kontrolou MDM atribútov
  }

  const existing = db.attributes.findById(id);
  if (!existing) {
    return validationErrorResponse("Tento atribút je priradený k existujúcim produktom a nedá sa vymazať. Najprv zmeňte hodnoty pri príslušných produktoch.");
  }

  db.attributes.delete(id);

  return successResponse({
    deleted: true,
    id,
    type:  existing.type,
    label: existing.label,
  });
}

// ─────────────────────────────────────────────────────────────
// OPTIONS – CORS preflight
// ─────────────────────────────────────────────────────────────

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
