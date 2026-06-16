import { type NextRequest } from "next/server";
import prisma from "@/lib/prisma";

const CONFIGURATOR_ORIGIN = process.env.CONFIGURATOR_ORIGIN ?? "http://localhost:3000";

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": CONFIGURATOR_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function addCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders())) {
    headers.set(k, v);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const session = await prisma.session.create({
      data: {}
    });
    return addCors(Response.json({ success: true, sessionId: session.id }, { status: 200 }));
  } catch (err) {
    return addCors(Response.json({ success: false, error: "DB Error" }, { status: 500 }));
  }
}
