import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { guardAuth, authErrorToResponse } from "@/lib/auth/rbac";

const CONFIGURATOR_ORIGIN = process.env.CONFIGURATOR_ORIGIN ?? "http://localhost:3000";

function addCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const DEFAULT_GDPR_TEXT = "<p>Základné podmienky spracovania osobných údajov (GDPR)...</p>";

export async function GET(request: NextRequest) {
  try {
    // Používame pretypovanie as any kým sa Prisma Client plne nevygeneruje
    const setting = await (prisma as any).systemSetting.findUnique({
      where: { key: "GDPR_TEXT" },
    });

    return NextResponse.json(
      { value: setting?.value || DEFAULT_GDPR_TEXT },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  } catch (err) {
    console.error("[gdpr] Failed to fetch settings:", err);
    return addCors(
      NextResponse.json(
        { error: "DB_ERROR", message: "Failed to fetch settings" },
        { status: 500 }
      )
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await guardAuth(request, { requireWrite: true }).catch(authErrorToResponse);
    if (auth instanceof Response) return addCors(auth);

    const body = await request.json();
    if (typeof body.value !== "string") {
      return addCors(
        NextResponse.json(
          { error: "INVALID_BODY", message: "Field 'value' must be a string." },
          { status: 400 }
        )
      );
    }

    const setting = await (prisma as any).systemSetting.upsert({
      where: { key: "GDPR_TEXT" },
      update: { value: body.value },
      create: { key: "GDPR_TEXT", value: body.value },
    });

    return addCors(NextResponse.json({ data: setting }));
  } catch (err) {
    console.error("[gdpr] Failed to save settings:", err);
    return addCors(
      NextResponse.json(
        { error: "DB_ERROR", message: "Failed to save settings" },
        { status: 500 }
      )
    );
  }
}

export async function OPTIONS() {
  return addCors(new Response(null, { status: 204 }));
}
