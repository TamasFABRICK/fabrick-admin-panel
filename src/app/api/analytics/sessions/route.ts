/**
 * POST /api/analytics/sessions
 * ──────────────────────────────
 * Receives session events from the FABRICK Visualizer frontend.
 * No authentication required – uses anonymous fingerprinting only.
 *
 * Payload:
 * {
 *   fingerprint: string,        // anonymous browser fingerprint
 *   event: SessionEvent,        // "session_start" | "combination_saved" | ...
 *   sessionId?: string,         // if resuming an existing session
 *   payload?: Record<string, unknown>,
 *   viewedProducts?: string[],  // product IDs visible in this event
 *   referrer?: string,
 *   userAgent?: string
 * }
 */

import { type NextRequest } from "next/server";
import { db, randomUUID } from "@/lib/db/store";
import {
  successResponse,
  validationErrorResponse,
  corsPreflightResponse,
} from "@/lib/api/response";
import { isNonEmptyString, type SessionEvent } from "@/lib/db/schema";

const VALID_EVENTS: SessionEvent[] = [
  "session_start",
  "combination_saved",
  "texture_downloaded",
  "contact_submitted",
  "session_end",
];

export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationErrorResponse("Request body must be valid JSON");
  }

  const { fingerprint, event, sessionId, payload, viewedProducts, referrer, userAgent } =
    (body ?? {}) as Record<string, unknown>;

  if (!isNonEmptyString(fingerprint)) {
    return validationErrorResponse("Field 'fingerprint' is required");
  }
  if (!VALID_EVENTS.includes(event as SessionEvent)) {
    return validationErrorResponse(
      `Field 'event' must be one of: ${VALID_EVENTS.join(", ")}`
    );
  }

  const now = new Date().toISOString();
  const eventObj = {
    event: event as SessionEvent,
    timestamp: now,
    payload: payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {},
  };

  if (event === "session_start") {
    const session = db.sessions.create({
      fingerprint: String(fingerprint),
      startedAt: now,
      endedAt: null,
      durationSeconds: null,
      abandoned: false,
      events: [eventObj],
      viewedProducts: Array.isArray(viewedProducts) ? (viewedProducts as string[]) : [],
      referrer: isNonEmptyString(referrer) ? String(referrer) : null,
      userAgent: isNonEmptyString(userAgent) ? String(userAgent) : null,
    });
    return successResponse({ sessionId: session.id }, 201);
  }

  // Locate existing session
  const sid = typeof sessionId === "string" ? sessionId : null;
  const existingSession = sid ? db.sessions.findById(sid) : null;

  if (!existingSession) {
    return validationErrorResponse(
      "Field 'sessionId' is required for events other than session_start"
    );
  }

  const updatedEvents = [...existingSession.events, eventObj];
  const updatedProducts = [
    ...new Set([
      ...existingSession.viewedProducts,
      ...(Array.isArray(viewedProducts) ? (viewedProducts as string[]) : []),
    ]),
  ];

  if (event === "session_end") {
    const durationSeconds = Math.round(
      (Date.now() - new Date(existingSession.startedAt).getTime()) / 1000
    );
    const abandoned = !updatedEvents.some(
      (e) => e.event === "contact_submitted"
    );
    db.sessions.update(existingSession.id, {
      endedAt: now,
      durationSeconds,
      abandoned,
      events: updatedEvents,
      viewedProducts: updatedProducts,
    });
  } else {
    db.sessions.update(existingSession.id, {
      events: updatedEvents,
      viewedProducts: updatedProducts,
    });
  }

  return successResponse({ sessionId: existingSession.id, event });
}
