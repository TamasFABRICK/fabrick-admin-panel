/**
 * FABRICK Admin Panel – Standardised API Response Helpers
 * ────────────────────────────────────────────────────────
 * All API routes should use these helpers to guarantee a
 * consistent JSON envelope across the entire backend.
 *
 * Success envelope:
 *   { success: true, data: T, meta?: PageMeta }
 *
 * Error envelope:
 *   { success: false, error: { code: string, message: string } }
 */

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PageMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

// ─────────────────────────────────────────────────────────────
// CORS headers (permissive for N8N / MCP integrations)
// ─────────────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Webhook-Secret",
};

// ─────────────────────────────────────────────────────────────
// Response builders
// ─────────────────────────────────────────────────────────────

export function successResponse<T>(
  data: T,
  status = 200,
  meta?: PageMeta
): Response {
  const body: ApiSuccess<T> = { success: true, data, ...(meta ? { meta } : {}) };
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function errorResponse(
  code: string,
  message: string,
  status: number
): Response {
  const body: ApiError = { success: false, error: { code, message } };
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function notFoundResponse(resource = "Resource"): Response {
  return errorResponse("NOT_FOUND", `${resource} not found`, 404);
}

export function unauthorizedResponse(message = "Unauthorized"): Response {
  return errorResponse("UNAUTHORIZED", message, 401);
}

export function forbiddenResponse(message = "Forbidden"): Response {
  return errorResponse("FORBIDDEN", message, 403);
}

export function validationErrorResponse(message: string): Response {
  return errorResponse("VALIDATION_ERROR", message, 422);
}

/** 201 Created – use after successfully persisting a new resource */
export function createdResponse<T>(data: T): Response {
  return successResponse(data, 201);
}

/** 409 Conflict – use when a duplicate / unique-constraint violation is detected */
export function conflictResponse(message: string): Response {
  return errorResponse("CONFLICT", message, 409);
}

export function internalErrorResponse(message = "Internal server error"): Response {
  return errorResponse("INTERNAL_ERROR", message, 500);
}

/** Pre-flight CORS response for OPTIONS requests */
export function corsPreflightResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ─────────────────────────────────────────────────────────────
// Pagination helper
// ─────────────────────────────────────────────────────────────

export function paginate<T>(
  items: T[],
  request: Request
): { data: T[]; meta: PageMeta } {
  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10))
  );
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const data = items.slice(start, start + pageSize);
  return { data, meta: { total, page, pageSize, totalPages } };
}
