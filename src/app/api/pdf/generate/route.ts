import { type NextRequest } from "next/server";
import { validationErrorResponse, errorResponse, corsPreflightResponse } from "@/lib/api/response";
import { generatePdfBuffer, PdfGeneratePayload } from "@/lib/pdfGenerator";

export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

/**
 * POST /api/pdf/generate
 *
 * Prijme JSON payload s konfiguračnými dátami z konfigurátora,
 * načíta HTML/CSS šablónu z DB, injektuje premenné a vygeneruje PDF
 * exkluzívne v pamäti (RAM). PDF buffer sa vráti klientovi ako stream.
 */
export async function POST(request: NextRequest): Promise<Response> {
  // ── 1. Parse payload ───────────────────────────────────────────────────────
  let body: PdfGeneratePayload;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  if (!body.brickName) {
    return validationErrorResponse("Pole 'brickName' je povinné");
  }

  try {
    const pdfBuffer = await generatePdfBuffer(body);

    // ── 6. Streamovanie PDF bufferu klientovi ─────────────────────────────────
    // Response BodyInit akceptuje ArrayBuffer alebo Uint8Array, nie Node Buffer priamo
    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="fabrick-konfiguracia.pdf"',
        "Content-Length": String(pdfBuffer.byteLength),
        "Cache-Control": "no-store, no-cache, must-revalidate",
        // CORS
        "Access-Control-Allow-Origin":
          process.env.CORS_ORIGIN ?? "https://konfigurator.fabrick.sk",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error) {
    const errObj = error as Error;
    if (errObj.message === "DB_ERROR") {
      return errorResponse("DB_ERROR", "Nepodarilo sa načítať šablónu z databázy", 500);
    }
    if (errObj.message === "TEMPLATE_NOT_FOUND") {
      return errorResponse(
        "TEMPLATE_NOT_FOUND",
        `PDF šablóna s kódom '${body.templateCode ?? "CONFIGURATION_OVERVIEW"}' nebola nájdená v databáze`,
        404
      );
    }
    if (errObj.message === "PDF_GENERATION_FAILED") {
      return errorResponse(
        "PDF_GENERATION_FAILED",
        "Generovanie PDF zlyhalo. Skontrolujte serverové logy.",
        500
      );
    }
    return errorResponse("UNKNOWN_ERROR", "Vyskytla sa neočakávaná chyba.", 500);
  }
}
