/**
 * FABRICK Admin Panel – In-Memory Data Store
 * ──────────────────────────────────────────
 * A lightweight JSON-file-backed store that acts as the database
 * layer until a real DB (Postgres / Supabase / PlanetScale) is wired in.
 *
 * All writes are immediately flushed to `data/db.json` so data
 * persists across Next.js dev-server restarts.
 *
 * Usage:
 *   import { db } from "@/lib/db/store";
 *   const products = db.products.findAll();
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  User,
  Product,
  Contact,
  AnalyticsSession,
  GlobalAttribute,
  MarketingSettings,
  ISODateString,
  UUID,
} from "./schema";
import { DEFAULT_MARKETING_SETTINGS } from "./schema";

// ─────────────────────────────────────────────────────────────
// Persistence layer
// ─────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

interface DbState {
  users: User[];
  products: Product[];
  contacts: Contact[];
  sessions: AnalyticsSession[];
  /** MDM attribute lists (colors, manufacturers, structures, formats, priceLevels) */
  attributes: GlobalAttribute[];
  /** Singleton – global marketing tracking IDs and SEO metadata */
  marketingSettings: MarketingSettings;
}

function loadState(): DbState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = buildInitialState();
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  return migrateState(JSON.parse(raw) as DbState);
}

/**
 * Backfills fields introduced in schema v2 (thumbnailUrl, textureUrls,
 * color, manufacturer, structure, priceLevel) so that existing db.json
 * produced before the schema extension remains valid without a full re-seed.
 */
function migrateState(state: DbState): DbState {
  state.products = state.products.map((p) => {
    // Double-cast through unknown to avoid TS overlap error between Product and Record<string,unknown>
    const legacy = p as unknown as Record<string, unknown>;
    return {
      // Schema v2 defaults
      thumbnailUrl: null,
      textureUrls: [],
      color: null,
      manufacturer: null,
      structure: null,
      priceLevel: null,
      // Schema v4 defaults – Admin Panel extension fields
      adminNotes:     null,
      configuratorId: null,
      lastSyncedAt:   null,
      // existing fields override the defaults above
      ...legacy,
    } as unknown as typeof p;
  });
  // Schema v3: backfill attributes array for DBs created before MDM feature
  if (!Array.isArray((state as unknown as Record<string, unknown>).attributes)) {
    (state as unknown as Record<string, unknown>).attributes = [];
  }
  // Schema v5: backfill marketingSettings singleton for existing db.json without this key
  const raw = state as unknown as Record<string, unknown>;
  if (!raw.marketingSettings || typeof raw.marketingSettings !== "object") {
    raw.marketingSettings = { ...DEFAULT_MARKETING_SETTINGS };
  }
  return state;
}

function saveState(state: DbState): void {
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// ─────────────────────────────────────────────────────────────
// Seed data
// ─────────────────────────────────────────────────────────────

function now(): ISODateString {
  return new Date().toISOString();
}

function buildInitialState(): DbState {
  const adminId: UUID = randomUUID();
  const viewerId: UUID = randomUUID();
  const brick1: UUID = randomUUID();
  const brick2: UUID = randomUUID();
  const mortar1: UUID = randomUUID();
  const bond1: UUID = randomUUID();

  const users: User[] = [
    {
      id: adminId,
      email: "admin@fabrick.sk",
      // bcrypt hash of "Admin1234!" – generated offline, safe to store here
      passwordHash:
        "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uha2",
      name: "FABRICK Admin",
      role: "super_admin",
      createdAt: now(),
      updatedAt: now(),
      lastLoginAt: null,
    },
    {
      id: viewerId,
      email: "viewer@fabrick.sk",
      passwordHash:
        "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
      name: "Sales Viewer",
      role: "viewer",
      createdAt: now(),
      updatedAt: now(),
      lastLoginAt: null,
    },
  ];

  const products: Product[] = [
    {
      id: brick1,
      name: "Antik cervená",
      category: "tehla",
      description: "Rucne formovaná tehla s rustikálnou povrchovou úpravou.",
      format: { width: 250, height: 65, depth: 120 },
      imageUrl: "/textures/antik-cervena.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: "cervená",
      manufacturer: "Wienerberger",
      structure: "rustikálna",
      priceLevel: "premium",
      status: "active",
      tags: ["antik", "cervena", "rustikal"],
      createdAt: now(),
      updatedAt: now(),
      createdBy: adminId,
      adminNotes:     null,
      configuratorId: null,
      lastSyncedAt:   null,
    },
    {
      id: brick2,
      name: "Loft sivá",
      category: "tehla",
      description: "Moderná loftová tehla v sivom odtieni.",
      format: { width: 290, height: 90, depth: 140 },
      imageUrl: "/textures/loft-siva.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: "sivá",
      manufacturer: "Tondach",
      structure: "hladká",
      priceLevel: "standard",
      status: "active",
      tags: ["loft", "siva", "modern"],
      createdAt: now(),
      updatedAt: now(),
      createdBy: adminId,
      adminNotes:     null,
      configuratorId: null,
      lastSyncedAt:   null,
    },
    {
      id: mortar1,
      name: "Skára biela",
      category: "skara",
      description: "Biela cementová skára pre interiérové aplikácie.",
      format: { width: 0, height: 0, depth: 0 },
      imageUrl: "/textures/skara-biela.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: "biela",
      manufacturer: "Baumit",
      structure: null,
      priceLevel: "economy",
      status: "active",
      tags: ["biela", "interier"],
      createdAt: now(),
      updatedAt: now(),
      createdBy: adminId,
      adminNotes:     null,
      configuratorId: null,
      lastSyncedAt:   null,
    },
    {
      id: bond1,
      name: "Flamská väzba",
      category: "vazba",
      description: "Klasická flamská tehliaca väzba.",
      format: { width: 0, height: 0, depth: 0 },
      imageUrl: "/textures/flamska-vazba.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: null,
      manufacturer: null,
      structure: null,
      priceLevel: null,
      status: "active",
      tags: ["flamska", "klasika"],
      createdAt: now(),
      updatedAt: now(),
      createdBy: adminId,
      adminNotes:     null,
      configuratorId: null,
      lastSyncedAt:   null,
    },
  ];

  const contacts: Contact[] = [
    {
      id: randomUUID(),
      name: "Ing. Peter Novák",
      email: "peter.novak@archstudio.sk",
      phone: "+421901234567",
      company: "ArchStudio s.r.o.",
      source: "visualizer",
      combination: { brickId: brick1, mortarId: mortar1, bondId: bond1 },
      metadata: {},
      gdprConsent: true,
      createdAt: now(),
      updatedAt: now(),
    },
  ];

  const sessions: AnalyticsSession[] = [];
  const attributes: GlobalAttribute[] = [];
  const marketingSettings: MarketingSettings = { ...DEFAULT_MARKETING_SETTINGS };

  return { users, products, contacts, sessions, attributes, marketingSettings };
}

// ─────────────────────────────────────────────────────────────
// Repository factories
// ─────────────────────────────────────────────────────────────

/**
 * Singleton repo – for entities where only one record exists in the
 * entire system (e.g. MarketingSettings). Does NOT use makeRepo.
 *
 * @param key    – Top-level key in DbState (must hold a plain object, not array)
 * @param dflt   – Default value written when the key is missing
 */
function makeSingletonRepo<T extends object>(key: keyof DbState, dflt: T) {
  return {
    /** Returns the singleton, falling back to dflt if the key is absent. */
    get(): T {
      const state = loadState();
      const val = (state as unknown as Record<string, unknown>)[key as string];
      return (typeof val === "object" && val !== null ? val : dflt) as T;
    },
    /**
     * Merges `patch` into the existing singleton and persists.
     * Only the keys present in `patch` are overwritten (partial update).
     *
     * @returns The fully updated singleton.
     */
    set(patch: Partial<T>): T {
      const state = loadState();
      const current = this.get();
      const updated = { ...current, ...patch } as T;
      (state as unknown as Record<string, unknown>)[key as string] = updated;
      saveState(state);
      return updated;
    },
  };
}

function makeRepo<T extends { id: UUID }>(key: keyof DbState) {
  return {
    findAll(): T[] {
      const state = loadState();
      return (state[key] as unknown) as T[];
    },
    findById(id: UUID): T | undefined {
      return this.findAll().find((item) => item.id === id);
    },
    create(data: Omit<T, "id" | "createdAt" | "updatedAt">): T {
      const state = loadState();
      const record = ({
        ...data,
        id: randomUUID(),
        createdAt: now(),
        updatedAt: now(),
      } as unknown) as T;
      ((state[key] as unknown) as T[]).push(record);
      saveState(state);
      return record;
    },
    update(id: UUID, patch: Partial<Omit<T, "id" | "createdAt">>): T | null {
      const state = loadState();
      const arr = (state[key] as unknown) as T[];
      const idx = arr.findIndex((item) => item.id === id);
      if (idx === -1) return null;
      arr[idx] = ({ ...arr[idx], ...patch, updatedAt: now() } as unknown) as T;
      saveState(state);
      return arr[idx];
    },
    delete(id: UUID): boolean {
      const state = loadState();
      const arr = (state[key] as unknown) as T[];
      const idx = arr.findIndex((item) => item.id === id);
      if (idx === -1) return false;
      arr.splice(idx, 1);
      saveState(state);
      return true;
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Public db object
// ─────────────────────────────────────────────────────────────

export const db = {
  users: {
    ...makeRepo<User>("users"),
    findByEmail(email: string): User | undefined {
      return db.users.findAll().find((u) => u.email === email);
    },
    touchLoginTime(id: UUID): void {
      db.users.update(id, { lastLoginAt: now() } as Partial<User>);
    },
  },
  products: makeRepo<Product>("products"),
  contacts: makeRepo<Contact>("contacts"),
  sessions: {
    ...makeRepo<AnalyticsSession>("sessions"),
    findByFingerprint(fp: string): AnalyticsSession[] {
      return db.sessions.findAll().filter((s) => s.fingerprint === fp);
    },
  },
  attributes: {
    ...makeRepo<GlobalAttribute>("attributes"),
    /**
     * Returns all active attributes of a given type, sorted by sortOrder asc.
     * Pass undefined to return all active attributes across all types.
     */
    findByType(type?: string): GlobalAttribute[] {
      return db.attributes
        .findAll()
        .filter((a) => a.active && (!type || a.type === type))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    },
  },
  /**
   * Singleton repo for global marketing and SEO settings.
   * Use db.marketingSettings.get() to read and .set(patch) to update.
   */
  marketingSettings: makeSingletonRepo<MarketingSettings>(
    "marketingSettings",
    DEFAULT_MARKETING_SETTINGS
  ),
};

// ─────────────────────────────────────────────────────────────
// Seed / reset helpers
// ─────────────────────────────────────────────────────────────

/** Full database state shape – exported so the seed script can construct it */
export type { DbState };
export type { GlobalAttribute };
export type { MarketingSettings };

/**
 * Atomically replaces the entire database with the provided state.
 * Only call from dev / seed tooling – never from production code paths.
 */
export function resetAndSeed(state: DbState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  saveState(state);
}

export { randomUUID };
