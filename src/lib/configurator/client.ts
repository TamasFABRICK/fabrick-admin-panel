/**
 * FABRICK Configurator Integration – HTTP Client
 * ───────────────────────────────────────────────
 * Server-side only (Node.js). Never import from client components.
 *
 * Configuration (via environment variables):
 *   CONFIGURATOR_API_URL   – Base URL of the Configurator REST API
 *                            e.g. "https://configurator.fabrick.sk/api"
 *   CONFIGURATOR_API_KEY   – Static Bearer token for service-to-service auth
 *   CONFIGURATOR_SYNC_MODE – "live" (always fetch) | "cached" (use snapshot)
 *                            Defaults to "live" when the env var is absent.
 *
 * Features:
 *   - Automatic Authorization: Bearer header injection
 *   - Retry with exponential back-off (3 attempts, 300 ms base delay)
 *   - Typed ConfiguratorApiError for upstream error handling
 *   - Request timeout (8 s) to avoid hanging Next.js route handlers
 */

import type { ConfiguratorApiResponse } from "./types";

// ─────────────────────────────────────────────────────────────
// Configuration helpers
// ─────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const url = process.env.CONFIGURATOR_API_URL;
  if (!url) {
    throw new ConfiguratorConfigError(
      "CONFIGURATOR_API_URL environment variable is not set. " +
        "Add it to .env.local before using the Configurator Integration Layer."
    );
  }
  // Strip trailing slash for consistent path joining
  return url.replace(/\/$/, "");
}

function getApiKey(): string {
  const key = process.env.CONFIGURATOR_API_KEY ?? "";
  return key;
}

export function getSyncMode(): "live" | "cached" {
  const mode = process.env.CONFIGURATOR_SYNC_MODE ?? "live";
  return mode === "cached" ? "cached" : "live";
}

// ─────────────────────────────────────────────────────────────
// Custom error classes
// ─────────────────────────────────────────────────────────────

export class ConfiguratorApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string
  ) {
    super(message);
    this.name = "ConfiguratorApiError";
  }
}

export class ConfiguratorConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfiguratorConfigError";
  }
}

// ─────────────────────────────────────────────────────────────
// Retry helper
// ─────────────────────────────────────────────────────────────

const MAX_RETRIES   = 3;
const BASE_DELAY_MS = 300;
const TIMEOUT_MS    = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────
// Core fetch wrapper
// ─────────────────────────────────────────────────────────────

/**
 * Low-level fetch with retry + timeout.
 * Logs every attempt and every failure to the terminal.
 * Throws the original error after all retries are exhausted.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempt = 1
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  console.debug(
    `[FABRICK:Client] → ${init.method ?? "GET"} ${url}` +
      (attempt > 1 ? ` (retry ${attempt - 1}/${MAX_RETRIES - 1})` : "")
  );

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);

    const e          = err as Error & { code?: string };
    const isTimeout  = e.name === "AbortError";
    const isRetryable =
      attempt < MAX_RETRIES &&
      (err instanceof TypeError || isTimeout);

    if (isRetryable) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `[FABRICK:Client] ✗ ${isTimeout ? "TIMEOUT" : e.code ?? e.name} ` +
          `fetching ${url} – retrying in ${delay}ms ` +
          `(attempt ${attempt}/${MAX_RETRIES})`
      );
      await sleep(delay);
      return fetchWithRetry(url, init, attempt + 1);
    }

    // All retries exhausted – log the precise error so the operator can diagnose
    console.error(
      `\n╔══════════════════════════════════════════════════════════════╗\n` +
      `║  [FABRICK:Client] CONFIGURATOR UNREACHABLE – ALL RETRIES FAILED  ║\n` +
      `╚══════════════════════════════════════════════════════════════╝\n` +
      `  Target URL : ${url}\n` +
      `  Error type : ${e.name}${e.code ? " (" + e.code + ")" : ""}\n` +
      `  Message    : ${e.message}\n` +
      `  Attempts   : ${attempt}/${MAX_RETRIES}\n` +
      `  Hint       : Is the Configurator API running at CONFIGURATOR_API_URL?\n`
    );

    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// Public API: configuratorFetch
// ─────────────────────────────────────────────────────────────

interface FetchOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?:   unknown;
  /** Extra headers merged on top of defaults */
  headers?: Record<string, string>;
}

/**
 * Fetches a Configurator API endpoint and returns the typed data payload.
 *
 * @param endpoint – Path relative to CONFIGURATOR_API_URL, e.g. "/products"
 * @param options  – Optional method, body, and extra headers
 * @returns The `.data` field from the standard Configurator envelope
 * @throws ConfiguratorApiError for HTTP error responses
 * @throws ConfiguratorConfigError when env vars are missing
 */
export async function configuratorFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { method = "GET", body, headers: extraHeaders = {} } = options;

  const url     = `${getBaseUrl()}${endpoint}`;
  const apiKey  = getApiKey();
  const mode    = getSyncMode();

  const headers: Record<string, string> = {
    "Content-Type":  "application/json",
    "Accept":        "application/json",
    ...extraHeaders,
  };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const init: RequestInit = {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    // Next.js fetch cache: always revalidate from Configurator when "live"
    next: mode === "live"
      ? { revalidate: 0 }
      : { revalidate: 86_400 }, // 24 h cache in "cached" mode
  };

  const response = await fetchWithRetry(url, init);

  // ── Parse response body (error payload may contain useful details) ──
  let json: ConfiguratorApiResponse<T>;
  try {
    json = (await response.json()) as ConfiguratorApiResponse<T>;
  } catch {
    const err = new ConfiguratorApiError(
      `Configurator returned non-JSON response (HTTP ${response.status})`,
      response.status,
      endpoint
    );
    console.error(
      `\n[FABRICK:Client] ✗ Non-JSON response from Configurator\n` +
      `  Endpoint    : ${url}\n` +
      `  HTTP status : ${response.status} ${response.statusText}\n`
    );
    throw err;
  }

  if (!response.ok || json.success === false) {
    const msg = json.error ?? `Configurator API error (HTTP ${response.status})`;
    console.error(
      `\n[FABRICK:Client] ✗ Configurator returned HTTP ${response.status}\n` +
      `  Endpoint    : ${url}\n` +
      `  HTTP status : ${response.status} ${response.statusText}\n` +
      `  Error msg   : ${msg}\n` +
      `  SYNC_MODE   : ${mode}\n`
    );
    throw new ConfiguratorApiError(msg, response.status, endpoint);
  }

  // Ak API vráti zabalený objekt s data atribútom (ConfiguratorApiResponse)
  if (json !== null && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }

  // Ak API vráti dáta priamo (napríklad čisté pole objektov)
  return json as unknown as T;
}
