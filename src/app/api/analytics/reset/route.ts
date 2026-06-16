import prisma from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api/response";

export async function POST(): Promise<Response> {
  try {
    // Zmazať všetky Sessions. TelemetryEvents sa zmažú kaskádovo (onDelete: Cascade)
    await prisma.session.deleteMany();
    
    // Nastaviť dátum resetu pre počítanie stiahnutí (Leads), ktoré nechceme zmazať fyzicky
    const now = new Date().toISOString();
    await prisma.systemSetting.upsert({
      where: { key: "analyticsResetDate" },
      update: { value: now },
      create: { key: "analyticsResetDate", value: now }
    });

    return successResponse({ message: "Analytické dáta boli úspešne vymazané." });
  } catch (error: unknown) {
    console.error("[analytics reset] Error:", error);
    return errorResponse("RESET_FAILED", "Failed to reset analytics data", 500);
  }
}
