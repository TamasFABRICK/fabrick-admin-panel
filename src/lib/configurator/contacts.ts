/**
 * FABRICK Configurator Integration – Contacts Repository
 * ───────────────────────────────────────────────────────
 * Strategy approved by Mission Control:
 *   - Contacts (CRM leads) are held locally in db.json (Admin Panel)
 *   - Configurator may also collect leads via the visualizer
 *   - This module fetches Configurator contacts and merges them with
 *     local CRM contacts, deduplicating by email address
 *   - Merged contacts are read-only from the Configurator side;
 *     Admin Panel may annotate (metadata) only its own local records
 *
 * NOTE: If the Configurator does not expose a /contacts endpoint,
 *       set CONFIGURATOR_HAS_CONTACTS_API=false in .env.local and
 *       this module will skip the remote fetch entirely.
 */

import { configuratorFetch, ConfiguratorApiError } from "./client";
import { db }                                        from "@/lib/db/store";
import type { ConfiguratorContact }                  from "./types";
import type { Contact }                              from "@/lib/db/schema";

// ─────────────────────────────────────────────────────────────
// Merged contact shape
// ─────────────────────────────────────────────────────────────

export type ContactSource = "local" | "configurator" | "merged";

export interface MergedContact {
  id:          string;
  name:        string;
  email:       string;
  phone:       string | null;
  company:     string | null;
  source:      ContactSource;
  combination: {
    brickId:  string | null;
    mortarId: string | null;
    bondId:   string | null;
  } | null;
  metadata:    Record<string, unknown>;
  gdprConsent: boolean;
  createdAt:   string;
  updatedAt:   string;
  /** Present when both a local and remote record exist for the same email */
  mergedFrom?: ("local" | "configurator")[];
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function hasContactsApi(): boolean {
  return process.env.CONFIGURATOR_HAS_CONTACTS_API !== "false";
}

function configuratorContactToMerged(c: ConfiguratorContact): MergedContact {
  return {
    id:          c.id,
    name:        c.name,
    email:       c.email,
    phone:       c.phone,
    company:     c.company,
    source:      "configurator",
    combination: c.combination,
    metadata:    c.metadata,
    gdprConsent: c.gdprConsent,
    createdAt:   c.createdAt,
    updatedAt:   c.updatedAt,
  };
}

function localContactToMerged(c: Contact): MergedContact {
  return {
    id:          c.id,
    name:        c.name,
    email:       c.email,
    phone:       c.phone ?? null,
    company:     c.company ?? null,
    source:      "local",
    combination: c.combination ?? null,
    metadata:    c.metadata,
    gdprConsent: c.gdprConsent,
    createdAt:   c.createdAt,
    updatedAt:   c.updatedAt,
  };
}

// ─────────────────────────────────────────────────────────────
// Core merge logic
// ─────────────────────────────────────────────────────────────

/**
 * Merges local contacts with Configurator contacts.
 * Deduplicates by email (case-insensitive).
 *
 * Merge rules:
 *   1. Local record wins for name/phone/company (admin may have richer data).
 *   2. Configurator record wins for combination (it's the visual event source).
 *   3. GDPR consent from either source → gdprConsent = true (OR semantics).
 *   4. Metadata objects are shallow-merged (Configurator keys + local keys).
 *
 * @param local         – Contacts from db.json
 * @param remote        – Contacts from Configurator API
 * @returns Deduplicated array sorted by createdAt descending
 */
function mergeContacts(
  local:  Contact[],
  remote: ConfiguratorContact[]
): MergedContact[] {
  // Index local contacts by normalised email
  const byEmail = new Map<string, MergedContact>();

  for (const c of local) {
    const key = c.email.toLowerCase().trim();
    byEmail.set(key, localContactToMerged(c));
  }

  // Merge in remote contacts
  for (const c of remote) {
    const key = c.email.toLowerCase().trim();
    const existing = byEmail.get(key);

    if (!existing) {
      // New contact from Configurator
      byEmail.set(key, configuratorContactToMerged(c));
    } else {
      // Merge: local wins for personal data, Configurator wins for combination
      byEmail.set(key, {
        ...existing,
        source:      "merged",
        mergedFrom:  ["local", "configurator"],
        // Configurator combination takes precedence (it's the visual event)
        combination: c.combination ?? existing.combination,
        // GDPR: OR semantics
        gdprConsent: existing.gdprConsent || c.gdprConsent,
        // Shallow metadata merge: Configurator keys + local keys (local overwrites)
        metadata:    { ...c.metadata, ...existing.metadata },
        // Use the earlier of the two createdAt dates
        createdAt:
          existing.createdAt < c.createdAt ? existing.createdAt : c.createdAt,
        // Use the later of the two updatedAt dates
        updatedAt:
          existing.updatedAt > c.updatedAt ? existing.updatedAt : c.updatedAt,
      });
    }
  }

  // Sort by createdAt descending (newest first)
  return Array.from(byEmail.values()).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt)
  );
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Fetches and merges contacts from both sources.
 *
 * If the Configurator contacts endpoint is unavailable or disabled,
 * returns only the local CRM contacts.
 *
 * @returns Array of MergedContact sorted by createdAt descending
 */
export async function fetchMergedContacts(): Promise<MergedContact[]> {
  const localContacts = db.contacts.findAll();

  if (!hasContactsApi()) {
    // Configurator contacts API not enabled – serve local only
    return localContacts.map(localContactToMerged).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    );
  }

  let remoteContacts: ConfiguratorContact[] = [];

  try {
    remoteContacts = await configuratorFetch<ConfiguratorContact[]>("/contacts");
  } catch (err) {
    if (err instanceof ConfiguratorApiError) {
      if (err.status === 404) {
        // Endpoint doesn't exist on this Configurator – log once and skip
        console.warn(
          "[FABRICK:Contacts] Configurator does not expose /contacts – serving local CRM only."
        );
      } else {
        console.error(
          `[FABRICK:Contacts] Configurator API error (${err.status}) – serving local CRM only.`,
          err.message
        );
      }
    } else {
      console.error("[FABRICK:Contacts] Network error – serving local CRM only.", err);
    }
    return localContacts.map(localContactToMerged).sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt)
    );
  }

  return mergeContacts(localContacts, remoteContacts);
}

/**
 * Returns only local CRM contacts (no remote merge).
 * Use when you need contacts the Admin Panel owns (e.g., for local edits).
 */
export function fetchLocalContacts(): MergedContact[] {
  return db.contacts
    .findAll()
    .map(localContactToMerged)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
