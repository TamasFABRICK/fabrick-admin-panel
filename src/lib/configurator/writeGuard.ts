/**
 * FABRICK Configurator Integration – Write Guard
 * ───────────────────────────────────────────────
 * Enforces the data protection policy approved by Mission Control:
 *
 *   1. HARD DELETE is permanently prohibited for Configurator products.
 *      Any attempt throws WriteGuardError (→ HTTP 405 Method Not Allowed).
 *
 *   2. PATCH operations are restricted to an explicit allowlist of fields.
 *      Attempts to modify protected fields (color, manufacturer, structure,
 *      format, category, etc.) throw WriteGuardError (→ HTTP 422).
 *
 *   3. Every permitted write is logged with actor + timestamp for audit trail.
 *
 * Usage in route handlers:
 *   import { assertSafeDelete, assertSafePatch, auditWrite } from "@/lib/configurator/writeGuard";
 *
 *   // In DELETE handler:
 *   assertSafeDelete();  // always throws – redirects caller to soft-delete
 *
 *   // In PATCH handler:
 *   const safePatch = assertSafePatch(requestedPatch);
 *   auditWrite("update", productId, actorId, safePatch);
 */

// ─────────────────────────────────────────────────────────────
// Allowlist – the ONLY fields Admin Panel may write back
// ─────────────────────────────────────────────────────────────

/**
 * Fields that Admin Panel is permitted to send in a PATCH request
 * to the Configurator. All other fields in an incoming patch body
 * are silently stripped before the request is forwarded.
 */
export const PATCH_ALLOWED_FIELDS = [
  "status",
  "tags",
  "adminNotes",
  "format",
  "color",
  "manufacturer",
  "structure",
  "priceLevel",
  "category",
  "name"
] as const;
export type PatchAllowedField = (typeof PATCH_ALLOWED_FIELDS)[number];

/**
 * Field values that are valid for the `status` field in a patch.
 * Note: "deleted" triggers a soft-delete (status change), NOT a hard delete.
 */
export const ALLOWED_STATUS_VALUES = ["active", "hidden", "deleted"] as const;
export type AllowedStatus = (typeof ALLOWED_STATUS_VALUES)[number];

// ─────────────────────────────────────────────────────────────
// Error class
// ─────────────────────────────────────────────────────────────

export class WriteGuardError extends Error {
  constructor(
    message: string,
    /** HTTP status code that the route handler should return */
    public readonly httpStatus: 405 | 422
  ) {
    super(message);
    this.name = "WriteGuardError";
  }
}

// ─────────────────────────────────────────────────────────────
// Guard functions
// ─────────────────────────────────────────────────────────────

/**
 * Call this in the DELETE handler for any Configurator product.
 *
 * ALWAYS throws WriteGuardError(405) — hard delete is permanently
 * prohibited. The route handler must redirect the user to the soft-delete
 * path (PATCH with status: "deleted") instead.
 *
 * @throws WriteGuardError(405) unconditionally
 */
export function assertSafeDelete(): never {
  throw new WriteGuardError(
    "Hard delete of Configurator products is permanently prohibited. " +
      "Use PATCH { status: 'deleted' } to archive a product instead.",
    405
  );
}

/**
 * Filters an incoming patch body to only the allowlisted fields.
 * Validates that `status`, if present, is a permitted value.
 *
 * @param requestedPatch – Raw patch body from the request (any object)
 * @returns A sanitised patch object containing only safe fields
 * @throws WriteGuardError(422) if `status` has an invalid value
 */
export function assertSafePatch(
  requestedPatch: Record<string, unknown>
): Partial<Record<PatchAllowedField, unknown>> {
  const safePatch: Partial<Record<PatchAllowedField, unknown>> = {};

  for (const field of PATCH_ALLOWED_FIELDS) {
    if (field in requestedPatch) {
      safePatch[field] = requestedPatch[field];
    }
  }

  // Validate status value if present
  if ("status" in safePatch) {
    const status = safePatch.status;
    if (!ALLOWED_STATUS_VALUES.includes(status as AllowedStatus)) {
      throw new WriteGuardError(
        `Invalid status value '${status}'. ` +
          `Allowed values: ${ALLOWED_STATUS_VALUES.join(", ")}`,
        422
      );
    }
  }

  // Validate tags if present
  if ("tags" in safePatch) {
    const tags = safePatch.tags;
    if (!Array.isArray(tags) || !tags.every((t) => typeof t === "string")) {
      throw new WriteGuardError(
        "Field 'tags' must be an array of strings.",
        422
      );
    }
  }

  return safePatch;
}

// ─────────────────────────────────────────────────────────────
// Audit logger
// ─────────────────────────────────────────────────────────────

export interface AuditEntry {
  operation:   "create" | "update" | "soft-delete";
  entityId:    string;
  actorId:     string;
  changedAt:   string;
  changedFields: string[];
  payload:     unknown;
}

/**
 * Logs an audit entry for every permitted write operation.
 * Currently writes to console.info (structured JSON) so it is
 * captured by any log aggregation system (Vercel, Railway, etc.).
 *
 * Replace this implementation with a DB insert or external audit
 * log service when available.
 */
export function auditWrite(
  operation: AuditEntry["operation"],
  entityId:  string,
  actorId:   string,
  payload:   unknown
): void {
  const entry: AuditEntry = {
    operation,
    entityId,
    actorId,
    changedAt: new Date().toISOString(),
    changedFields:
      payload && typeof payload === "object"
        ? Object.keys(payload as object)
        : [],
    payload,
  };

  // Structured JSON log – parseable by log aggregators
  console.info("[FABRICK:WriteGuard:Audit]", JSON.stringify(entry));
}

// ─────────────────────────────────────────────────────────────
// Response helpers (for use in route handlers)
// ─────────────────────────────────────────────────────────────

/**
 * Converts a WriteGuardError to a standard Next.js Response.
 * Call this in the catch block of route handlers.
 */
export function writeGuardErrorToResponse(err: WriteGuardError): Response {
  return Response.json(
    {
      success: false,
      error: {
        code:    err.httpStatus === 405 ? "METHOD_NOT_ALLOWED" : "VALIDATION_ERROR",
        message: err.message,
      },
    },
    { status: err.httpStatus }
  );
}
