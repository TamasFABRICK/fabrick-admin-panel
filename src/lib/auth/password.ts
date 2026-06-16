/**
 * FABRICK Admin Panel – Password Utilities
 * ─────────────────────────────────────────
 * Wraps bcryptjs so the rest of the codebase never imports it directly.
 * bcryptjs is pure-JS (no native bindings) and works in any Node.js
 * environment including Vercel's serverless functions.
 *
 * Rounds: 12  (≈ 250 ms on a modern server – good balance of security/speed)
 */

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hashes a plain-text password.
 * Always use this before storing a password to the database.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a stored bcrypt hash.
 * Returns true if they match, false otherwise.
 * Safe against timing attacks (bcryptjs uses constant-time comparison).
 */
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  // Reject obviously fake / placeholder hashes to prevent false positives
  if (!hash.startsWith("$2")) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Synchronous hash – only for seed scripts where async is inconvenient.
 * Do NOT use in request handlers (blocks the event loop).
 */
export function hashPasswordSync(plain: string): string {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}
