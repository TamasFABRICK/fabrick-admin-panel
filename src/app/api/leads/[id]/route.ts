import { type NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/api/response";
import prisma from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;

  try {
    const body = await request.json();
    
    // Only extract the fields we allow to be patched
    const dataToUpdate: any = {};
    if (typeof body.isRead === 'boolean') {
      dataToUpdate.isRead = body.isRead;
    }
    if (typeof body.isArchived === 'boolean') {
      dataToUpdate.isArchived = body.isArchived;
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return errorResponse("BAD_REQUEST", "No valid fields provided for update", 400);
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: dataToUpdate,
    });

    return successResponse(updatedLead);
  } catch (err: any) {
    console.error(`[leads] Failed to update lead ${id}:`, err);
    if (err.code === 'P2025') {
      return errorResponse("NOT_FOUND", "Lead not found", 404);
    }
    return errorResponse("DB_ERROR", "Failed to update lead", 500);
  }
}
