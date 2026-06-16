import { type NextRequest } from "next/server";
import {
  successResponse,
  notFoundResponse,
  errorResponse,
} from "@/lib/api/response";
import prisma from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────
// GET /api/products/[id]  – lazy loading with textures
// ─────────────────────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    
    // Lazy loading from Prisma including textures (Zone B, etc.)
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        textures: true,
      },
    });

    if (!product) {
      return notFoundResponse("Product");
    }

    return successResponse(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return errorResponse("DB_ERROR", "Failed to fetch product", 500);
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/products/[id]  – update product details
// Accepts JSON body with new Prisma schema keys:
//   name, dominantnaFarba, manufacturer, structure, priceLevelId, formatConfigId
// ─────────────────────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse("PARSE_ERROR", "Request body must be valid JSON", 400);
    }

    // Validate if product exists
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse("Product");
    }

    // Build partial update data using new Prisma schema field names.
    // Only fields explicitly present in the body are updated (undefined = keep existing).
    const data: Record<string, unknown> = {};

    if (body.name !== undefined)           data.name           = String(body.name).trim();
    if (body.dominantnaFarba !== undefined) data.dominantnaFarba = String(body.dominantnaFarba).trim();
    if (body.manufacturer !== undefined)    data.manufacturer    = String(body.manufacturer).trim();
    if (body.structure !== undefined)       data.structure       = body.structure !== "" ? String(body.structure).trim() : null;

    if (body.formatConfigId !== undefined) {
      data.formatConfigId = body.formatConfigId === "" ? null : body.formatConfigId;
    }

    if (body.priceLevelId !== undefined) {
      data.priceLevelId = body.priceLevelId === "" ? null : body.priceLevelId;
    }
    if (body.exactPrice !== undefined) {
      data.exactPrice = body.exactPrice === null || body.exactPrice === "" ? null : parseFloat(String(body.exactPrice));
    }
    if (body.isManualPriceOverride !== undefined) {
      data.isManualPriceOverride = body.isManualPriceOverride === true || body.isManualPriceOverride === "true";
    }

    // isActive: stored as Boolean in Prisma
    if (body.isActive !== undefined) {
      data.isActive = body.isActive === true || body.isActive === "true";
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data,
    });

    return successResponse(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    return errorResponse("DB_ERROR", "Failed to update product", 500);
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/products/[id]  – soft archive via isActive=false
// ─────────────────────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return notFoundResponse("Product");
    }

    // Soft delete – nastaví isActive=false (produkt zostane v DB ale skryje sa z konfigurátora)
    const archived = await prisma.product.update({
      where: { id },
      data:  { isActive: false },
    });

    return successResponse({ id, archived: true, isActive: false, message: "Product archived (hidden from configurator)." });
  } catch (error) {
    console.error('Error archiving product:', error);
    return errorResponse("DB_ERROR", "Failed to archive product", 500);
  }
}
