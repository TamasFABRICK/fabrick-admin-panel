/**
 * FABRICK Admin Panel – Auth Middleware Helper
 * ─────────────────────────────────────────────
 * Thin re-export shim for backward compatibility.
 * New code should import directly from "@/lib/auth/rbac".
 *
 * Kept so existing imports `from "@/lib/auth/middleware"` continue
 * to work without touching every file simultaneously.
 */

export { AuthError, guardAuth as requireAuth, authErrorToResponse } from "./rbac";
export type { GuardOptions } from "./rbac";

// requireRole is still exported for any legacy call-sites,
// but prefer guardAuth({ roles: [...] }) in new code.
import type { JwtPayload } from "./jwt";
import { AuthError } from "./rbac";

export function requireRole(payload: JwtPayload, allowed: string[]): void {
  if (!allowed.includes(payload.role)) {
    throw new AuthError(
      `Role '${payload.role}' is not authorized for this resource`,
      403
    );
  }
}
