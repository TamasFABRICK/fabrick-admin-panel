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
    const body = await request.json();
    const sessionId = body.sessionId;
    if (!sessionId) {
       return addCors(Response.json({ success: false, error: "Missing sessionId" }, { status: 400 }));
    }
    
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        lastActiveAt: new Date(),
        isBounce: false,
      }
    });

    return addCors(Response.json({ success: true }, { status: 200 }));
  } catch (err) {
    return addCors(Response.json({ success: false, error: "DB Error" }, { status: 500 }));
  }
}
