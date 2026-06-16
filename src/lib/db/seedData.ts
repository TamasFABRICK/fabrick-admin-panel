/**
 * FABRICK Admin Panel – Seed Data Builder
 * ────────────────────────────────────────
 * Builds a complete, deterministic database state for QA / demo purposes.
 *
 * Product popularity targets (LEFT JOIN test data):
 *
 * TEHLY (bricks):
 *   Rustikálna červená  – sessionViews=8,  combinationSaves=5  → score=13  rank=1
 *   Moderná šedá        – sessionViews=5,  combinationSaves=3  → score=8   rank=2
 *   Antická biela       – sessionViews=4,  combinationSaves=2  → score=6   rank=3
 *   Prírodná hnedá      – sessionViews=2,  combinationSaves=1  → score=3   rank=5 (tie)
 *   Loft čierna         – sessionViews=0,  combinationSaves=0  → score=0   rank=11 ← ZERO (LEFT JOIN test)
 *
 * ŠKÁRY (mortars):
 *   Biela 10mm          – sessionViews=6,  combinationSaves=4  → score=10  rank=2 (tie w/ other)
 *   Antracitová 10mm    – sessionViews=3,  combinationSaves=2  → score=5   rank=4 (tie)
 *   Svetlo šedá 12mm    – sessionViews=2,  combinationSaves=1  → score=3   rank=5 (tie)
 *
 * VÄZBY (bonds):
 *   Divoká väzba        – sessionViews=4,  combinationSaves=3  → score=7   rank=3 (tie)
 *   Flámska väzba       – sessionViews=2,  combinationSaves=1  → score=3   rank=5 (tie)
 *   Behúňová väzba      – sessionViews=0,  combinationSaves=0  → score=0   rank=11 ← ZERO (LEFT JOIN test)
 */

import { randomUUID } from "node:crypto";
import type {
  User,
  Product,
  Contact,
  AnalyticsSession,
  AnalyticsEvent,
  GlobalAttribute,
  MarketingSettings,
} from "@/lib/db/schema";
import { DEFAULT_MARKETING_SETTINGS } from "@/lib/db/schema";
import type { DbState } from "@/lib/db/store";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function iso(daysAgo: number, hourOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hourOffset);
  return d.toISOString();
}

function makeSession(
  fingerprint: string,
  startedDaysAgo: number,
  durationSeconds: number,
  viewedProducts: string[],
  abandoned: boolean,
  events: AnalyticsEvent[]
): AnalyticsSession {
  const startedAt = iso(startedDaysAgo);
  const endedAt = new Date(
    new Date(startedAt).getTime() + durationSeconds * 1000
  ).toISOString();
  return {
    id: randomUUID(),
    fingerprint,
    startedAt,
    endedAt,
    durationSeconds,
    abandoned,
    events,
    viewedProducts,
    referrer: "https://fabrick.sk",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  };
}

/**
 * Injects schema-v4 extension-field defaults so seed product literals
 * satisfy the updated Product interface without repeating nulls everywhere.
 */
function makeSeedProduct(p: Omit<Product, "adminNotes" | "configuratorId" | "lastSyncedAt">): Product {
  return {
    ...p,
    adminNotes:     null,
    configuratorId: null,
    lastSyncedAt:   null,
  };
}

// ─────────────────────────────────────────────────────────────
// Build
// ─────────────────────────────────────────────────────────────

export function buildSeedState(): DbState {
  // ── IDs (pre-defined so cross-entity references are consistent) ──
  const ADMIN_ID = randomUUID();
  const VIEWER_ID = randomUUID();

  // Tehly
  const BRICK_RUSTIKAL = randomUUID(); // score 13 – rank 1
  const BRICK_MODERN   = randomUUID(); // score 8  – rank 2
  const BRICK_ANTIK    = randomUUID(); // score 6  – rank 3
  const BRICK_NATURAL  = randomUUID(); // score 3  – rank 5
  const BRICK_LOFT     = randomUUID(); // score 0  – ZERO (LEFT JOIN test)

  // Škáry
  const MORTAR_WHITE   = randomUUID(); // score 10 – rank 2 (tie)
  const MORTAR_ANTRAC  = randomUUID(); // score 5  – rank 4 (tie)
  const MORTAR_GREY    = randomUUID(); // score 3  – rank 5 (tie)

  // Väzby
  const BOND_WILD      = randomUUID(); // score 7  – rank 3 (tie)
  const BOND_FLEMISH   = randomUUID(); // score 3  – rank 5 (tie)
  const BOND_RUNNER    = randomUUID(); // score 0  – ZERO (LEFT JOIN test)

  const now = new Date().toISOString();

  // ── Users ─────────────────────────────────────────────────
  const users: User[] = [
    {
      id: ADMIN_ID,
      email: "admin@fabrick.sk",
      passwordHash: "$2b$12$placeholder-hash-admin123",
      name: "FABRICK Admin",
      role: "super_admin",
      createdAt: iso(30),
      updatedAt: now,
      lastLoginAt: iso(0),
    },
    {
      id: VIEWER_ID,
      email: "viewer@fabrick.sk",
      passwordHash: "$2b$12$placeholder-hash-viewer123",
      name: "Sales Viewer",
      role: "viewer",
      createdAt: iso(30),
      updatedAt: now,
      lastLoginAt: iso(2),
    },
  ];

  // -- Products --
  const products: Product[] = [
    // -- TEHLY --
    makeSeedProduct({
      id: BRICK_RUSTIKAL,
      name: "Rustikalná cervená",
      category: "tehla",
      description: "Rucne tvarovaná lícová tehla s rustikálnym povrchom a hlbokou cervenou farbou. Ideálna pre externé fasády rodinných domov.",
      format: { width: 250, height: 65, depth: 120 },
      imageUrl: "/textures/rustikal-cervena.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: "cervená",
      manufacturer: "Wienerberger",
      structure: "rustikálna",
      priceLevel: "premium",
      status: "active",
      tags: ["rustikal", "cervena", "exterier", "licova"],
      createdAt: iso(28),
      updatedAt: now,
      createdBy: ADMIN_ID,
    }),
    makeSeedProduct({
      id: BRICK_MODERN,
      name: "Moderná sedá",
      category: "tehla",
      description: "Hladká lícová tehla v neutrálnom sivom odtieni. Perfektná pre moderné minimalistické stavby a loftové interiéry.",
      format: { width: 290, height: 90, depth: 140 },
      imageUrl: "/textures/moderna-seda.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: "sedá",
      manufacturer: "Tondach",
      structure: "hladká",
      priceLevel: "standard",
      status: "active",
      tags: ["moderni", "seda", "minimalizmus", "loft"],
      createdAt: iso(27),
      updatedAt: now,
      createdBy: ADMIN_ID,
    }),
    makeSeedProduct({
      id: BRICK_ANTIK,
      name: "Antická biela",
      category: "tehla",
      description: "Tehla s antickým opracovaním v krémovo-bielej farbe. Vytvára vzdusný a elegantný dojem v interiéroch aj exteriéroch.",
      format: { width: 250, height: 65, depth: 120 },
      imageUrl: "/textures/antik-biela.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: "biela",
      manufacturer: "Röben",
      structure: "antik",
      priceLevel: "premium",
      status: "active",
      tags: ["antik", "biela", "kremova", "elegantna"],
      createdAt: iso(26),
      updatedAt: now,
      createdBy: ADMIN_ID,
    }),
    makeSeedProduct({
      id: BRICK_NATURAL,
      name: "Prírodná hnedá",
      category: "tehla",
      description: "Tehla v teplej hnedej farbe s prírodnou textúrou. Vhodná pre vidiecke a tradicné stavby.",
      format: { width: 250, height: 65, depth: 120 },
      imageUrl: "/textures/prirodna-hneda.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: "hnedá",
      manufacturer: "Wienerberger",
      structure: "rustikálna",
      priceLevel: "economy",
      status: "active",
      tags: ["prirodna", "hneda", "tradicna", "vidiecka"],
      createdAt: iso(25),
      updatedAt: now,
      createdBy: ADMIN_ID,
    }),
    makeSeedProduct({
      id: BRICK_LOFT,
      name: "Loft cierna",
      category: "tehla",
      description: "Exkluzívna cierna lícová tehla pre odvázne interiérové a exteriérové projekty. Industriálny charakter.",
      format: { width: 290, height: 90, depth: 140 },
      imageUrl: "/textures/loft-cierna.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: "cierna",
      manufacturer: "Tondach",
      structure: "hladká",
      priceLevel: "luxury",
      status: "active",
      tags: ["loft", "cierna", "industrial", "premium"],
      createdAt: iso(24),
      updatedAt: now,
      createdBy: ADMIN_ID,
      // <- ZERO VIEWS - intentional LEFT JOIN test case
    }),
    // -- SKARY --
    makeSeedProduct({
      id: MORTAR_WHITE,
      name: "Biela 10mm",
      category: "skara",
      description: "Klasická biela skára sírky 10mm. Nadcasová a univerzálna volba pre väcsinu murovacích kombinácií.",
      format: { width: 10, height: 0, depth: 0 },
      imageUrl: "/textures/skara-biela-10.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: "biela",
      manufacturer: "Baumit",
      structure: null,
      priceLevel: "economy",
      status: "active",
      tags: ["biela", "10mm", "klasika", "univerzalna"],
      createdAt: iso(28),
      updatedAt: now,
      createdBy: ADMIN_ID,
    }),
    makeSeedProduct({
      id: MORTAR_ANTRAC,
      name: "Antracitová 10mm",
      category: "skara",
      description: "Tmavá antracitová skára 10mm pre moderné fasády. Vynikajúco kontrastuje so svetlými tehlami.",
      format: { width: 10, height: 0, depth: 0 },
      imageUrl: "/textures/skara-antracit-10.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: "antracitová",
      manufacturer: "Baumit",
      structure: null,
      priceLevel: "economy",
      status: "active",
      tags: ["antracit", "tmava", "10mm", "kontrast"],
      createdAt: iso(27),
      updatedAt: now,
      createdBy: ADMIN_ID,
    }),
    makeSeedProduct({
      id: MORTAR_GREY,
      name: "Svetlo sedá 12mm",
      category: "skara",
      description: "Svetlo sedá skára so sirsím profilom 12mm. Zvyraznuje horizontálne línie muriva.",
      format: { width: 12, height: 0, depth: 0 },
      imageUrl: "/textures/skara-svetloseda-12.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: "sedá",
      manufacturer: "Mapei",
      structure: null,
      priceLevel: "standard",
      status: "active",
      tags: ["svetloseda", "12mm", "horizontalna"],
      createdAt: iso(26),
      updatedAt: now,
      createdBy: ADMIN_ID,
    }),
    // -- VAZBY --
    makeSeedProduct({
      id: BOND_WILD,
      name: "Divoká väzba",
      category: "vazba",
      description: "Nepravidelná väzba s rozmanitým usporiadaním tehál. Vytvára dynamický a originálny vzhlad fasády.",
      format: { width: 0, height: 0, depth: 0 },
      imageUrl: "/textures/vazba-divoka.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: null,
      manufacturer: null,
      structure: null,
      priceLevel: null,
      status: "active",
      tags: ["divoka", "nepravidelna", "dynamicka", "originalna"],
      createdAt: iso(28),
      updatedAt: now,
      createdBy: ADMIN_ID,
    }),
    makeSeedProduct({
      id: BOND_FLEMISH,
      name: "Flámska väzba",
      category: "vazba",
      description: "Klasická flámska väzba s pravidelným striedaním behúnov a väzákov. Esteticky aj konstrukcne overená.",
      format: { width: 0, height: 0, depth: 0 },
      imageUrl: "/textures/vazba-flamska.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: null,
      manufacturer: null,
      structure: null,
      priceLevel: null,
      status: "active",
      tags: ["flamska", "klasika", "pravidelna"],
      createdAt: iso(27),
      updatedAt: now,
      createdBy: ADMIN_ID,
    }),
    makeSeedProduct({
      id: BOND_RUNNER,
      name: "Behúnová väzba",
      category: "vazba",
      description: "Najjednoduchsia väzba pozostávajúca výlucne z behúnov. Minimalistická a rýchla na realizáciu.",
      format: { width: 0, height: 0, depth: 0 },
      imageUrl: "/textures/vazba-behunova.jpg",
      thumbnailUrl: null,
      textureUrls: [],
      color: null,
      manufacturer: null,
      structure: null,
      priceLevel: null,
      status: "active",
      tags: ["behunova", "minimalizmus", "jednoducha"],
      createdAt: iso(26),
      updatedAt: now,
      createdBy: ADMIN_ID,
      // <- ZERO VIEWS - intentional LEFT JOIN test case
    }),
  ];

  // ── Contacts (drive combinationSaves counts) ───────────────
  //
  // Each contact with combination.brickId/mortarId/bondId
  // increments combinationSaves for that product.
  //
  // Target saves per product:
  //   BRICK_RUSTIKAL: 5  MORTAR_WHITE: 4  BOND_WILD: 3
  //   BRICK_MODERN:   3  MORTAR_ANTRAC: 2  BOND_FLEMISH: 1
  //   BRICK_ANTIK:    2  MORTAR_GREY: 1
  //   BRICK_NATURAL:  1
  //   BRICK_LOFT:     0  BOND_RUNNER: 0
  const contacts: Contact[] = [
    // Contact 1 – Rustikálna červená + Biela 10mm + Divoká väzba
    {
      id: randomUUID(),
      name: "Ing. Peter Novák",
      email: "peter.novak@archstudio.sk",
      phone: "+421901234567",
      company: "ArchStudio s.r.o.",
      source: "visualizer",
      combination: { brickId: BRICK_RUSTIKAL, mortarId: MORTAR_WHITE, bondId: BOND_WILD },
      metadata: { campaign: "google-ads" },
      gdprConsent: true,
      createdAt: iso(28),
      updatedAt: iso(28),
    },
    // Contact 2 – Rustikálna červená + Biela 10mm + Divoká väzba
    {
      id: randomUUID(),
      name: "Mgr. Jana Kováčová",
      email: "jana.kovacova@design.sk",
      phone: "+421902345678",
      company: "Design Studio BA",
      source: "visualizer",
      combination: { brickId: BRICK_RUSTIKAL, mortarId: MORTAR_WHITE, bondId: BOND_WILD },
      metadata: { campaign: "organic" },
      gdprConsent: true,
      createdAt: iso(25),
      updatedAt: iso(25),
    },
    // Contact 3 – Moderná šedá + Antracitová + Divoká väzba
    {
      id: randomUUID(),
      name: "Bc. Tomáš Horváth",
      email: "tomas.horvath@buildco.sk",
      phone: "+421903456789",
      company: "BuildCo SK",
      source: "visualizer",
      combination: { brickId: BRICK_MODERN, mortarId: MORTAR_ANTRAC, bondId: BOND_WILD },
      metadata: {},
      gdprConsent: true,
      createdAt: iso(22),
      updatedAt: iso(22),
    },
    // Contact 4 – Rustikálna červená + Biela 10mm + Flámska väzba
    {
      id: randomUUID(),
      name: "Ing. arch. Mária Lechnerová",
      email: "m.lechnerova@atelier.sk",
      phone: null,
      company: "Atelier ML s.r.o.",
      source: "visualizer",
      combination: { brickId: BRICK_RUSTIKAL, mortarId: MORTAR_WHITE, bondId: BOND_FLEMISH },
      metadata: { referrer: "archiweb.sk" },
      gdprConsent: true,
      createdAt: iso(20),
      updatedAt: iso(20),
    },
    // Contact 5 – Antická biela + Biela 10mm + Divoká väzba
    {
      id: randomUUID(),
      name: "Martin Krajčí",
      email: "martin.krajci@gmail.com",
      phone: "+421905678901",
      company: null,
      source: "visualizer",
      combination: { brickId: BRICK_ANTIK, mortarId: MORTAR_WHITE, bondId: null },
      metadata: {},
      gdprConsent: true,
      createdAt: iso(18),
      updatedAt: iso(18),
    },
    // Contact 6 – Moderná šedá + Antracitová + null bond
    {
      id: randomUUID(),
      name: "Ing. Lucia Benková",
      email: "l.benkova@studio-b.sk",
      phone: "+421906789012",
      company: "Studio B",
      source: "webhook",
      combination: { brickId: BRICK_MODERN, mortarId: MORTAR_ANTRAC, bondId: null },
      metadata: { source_form: "contact_page" },
      gdprConsent: true,
      createdAt: iso(15),
      updatedAt: iso(15),
    },
    // Contact 7 – Rustikálna červená + Svetlo šedá + null bond
    {
      id: randomUUID(),
      name: "Ján Šimko",
      email: "jan.simko@simkoarchitects.sk",
      phone: null,
      company: "Šimko Architects",
      source: "visualizer",
      combination: { brickId: BRICK_RUSTIKAL, mortarId: MORTAR_GREY, bondId: null },
      metadata: {},
      gdprConsent: true,
      createdAt: iso(13),
      updatedAt: iso(13),
    },
    // Contact 8 – Antická biela + Biela 10mm + null bond
    {
      id: randomUUID(),
      name: "Eva Molnárová",
      email: "eva.molnarova@molnar.sk",
      phone: "+421908901234",
      company: null,
      source: "visualizer",
      combination: { brickId: BRICK_ANTIK, mortarId: MORTAR_WHITE, bondId: null },
      metadata: {},
      gdprConsent: true,
      createdAt: iso(10),
      updatedAt: iso(10),
    },
    // Contact 9 – Prírodná hnedá + Biela 10mm + Flámska väzba
    {
      id: randomUUID(),
      name: "Radoslav Takáč",
      email: "r.takac@takac-build.sk",
      phone: "+421909012345",
      company: "Takáč Build s.r.o.",
      source: "visualizer",
      combination: { brickId: BRICK_NATURAL, mortarId: MORTAR_WHITE, bondId: BOND_FLEMISH },
      metadata: {},
      gdprConsent: true,
      createdAt: iso(7),
      updatedAt: iso(7),
    },
    // Contact 10 – Moderná šedá + Antracitová + null bond
    {
      id: randomUUID(),
      name: "Zuzana Farkašová",
      email: "z.farkasova@fdesign.sk",
      phone: null,
      company: "F Design Studio",
      source: "n8n",
      combination: { brickId: BRICK_MODERN, mortarId: null, bondId: null },
      metadata: { n8n_workflow: "contact_form_v2" },
      gdprConsent: true,
      createdAt: iso(3),
      updatedAt: iso(3),
    },
    // Contact 11 – Rustikálna červená only (webhook from N8N, no combination)
    {
      id: randomUUID(),
      name: "Peter Baláž",
      email: "p.balaz@balaz-studio.sk",
      phone: "+421910123456",
      company: "Baláž Studio",
      source: "n8n",
      combination: { brickId: BRICK_RUSTIKAL, mortarId: null, bondId: null },
      metadata: { n8n_workflow: "brick_enquiry" },
      gdprConsent: true,
      createdAt: iso(1),
      updatedAt: iso(1),
    },
  ];

  // ── Analytics Sessions (drive sessionViews counts) ─────────
  //
  // session.viewedProducts array entries increment sessionViews.
  // Each product ID can appear multiple times across sessions.
  //
  // Target session views per product (within last 30 days):
  //   BRICK_RUSTIKAL: 8  MORTAR_WHITE: 6  BOND_WILD: 4
  //   BRICK_MODERN:   5  MORTAR_ANTRAC: 3  BOND_FLEMISH: 2
  //   BRICK_ANTIK:    4  MORTAR_GREY: 2
  //   BRICK_NATURAL:  2
  //   BRICK_LOFT:     0  BOND_RUNNER: 0

  // Helper: event sequence for a normal completed session
  function completedEvents(startedAt: string, durationS: number): AnalyticsEvent[] {
    const t1 = new Date(new Date(startedAt).getTime() + durationS * 500).toISOString();
    const t2 = new Date(new Date(startedAt).getTime() + durationS * 900).toISOString();
    const t3 = new Date(new Date(startedAt).getTime() + durationS * 1000).toISOString();
    return [
      { event: "session_start", timestamp: startedAt, payload: {} },
      { event: "combination_saved", timestamp: t1, payload: {} },
      { event: "texture_downloaded", timestamp: t2, payload: {} },
      { event: "contact_submitted", timestamp: t3, payload: {} },
      { event: "session_end", timestamp: t3, payload: {} },
    ];
  }

  function abandonedEvents(startedAt: string): AnalyticsEvent[] {
    return [
      { event: "session_start", timestamp: startedAt, payload: {} },
      { event: "session_end", timestamp: new Date(new Date(startedAt).getTime() + 45000).toISOString(), payload: {} },
    ];
  }

  const sessions: AnalyticsSession[] = [
    // ── Day 27-28: Heavy traffic day ───────────────────────────
    makeSession("fp-001", 28, 312, [BRICK_RUSTIKAL, MORTAR_WHITE, BOND_WILD], false,
      completedEvents(iso(28), 312)),
    makeSession("fp-002", 27, 245, [BRICK_RUSTIKAL, BRICK_MODERN, MORTAR_WHITE], false,
      completedEvents(iso(27), 245)),
    makeSession("fp-003", 27, 189, [BRICK_ANTIK, MORTAR_WHITE, BOND_WILD], false,
      completedEvents(iso(27, 2), 189)),

    // ── Day 22-25: Mid-month traffic ───────────────────────────
    makeSession("fp-004", 25, 423, [BRICK_RUSTIKAL, MORTAR_ANTRAC, BOND_FLEMISH], false,
      completedEvents(iso(25), 423)),
    makeSession("fp-005", 24, 156, [BRICK_MODERN, MORTAR_WHITE], false,
      completedEvents(iso(24), 156)),
    makeSession("fp-006", 23, 88, [BRICK_ANTIK, MORTAR_ANTRAC], true,
      abandonedEvents(iso(23))),
    makeSession("fp-007", 22, 334, [BRICK_RUSTIKAL, BRICK_MODERN, MORTAR_WHITE, BOND_WILD], false,
      completedEvents(iso(22), 334)),

    // ── Day 15-20: Regular traffic ─────────────────────────────
    makeSession("fp-008", 20, 211, [BRICK_ANTIK, MORTAR_WHITE, BOND_WILD], false,
      completedEvents(iso(20), 211)),
    makeSession("fp-009", 19, 67, [BRICK_NATURAL, MORTAR_GREY], true,
      abandonedEvents(iso(19))),
    makeSession("fp-010", 18, 290, [BRICK_MODERN, MORTAR_ANTRAC, BOND_FLEMISH], false,
      completedEvents(iso(18), 290)),
    makeSession("fp-011", 17, 178, [BRICK_RUSTIKAL, MORTAR_WHITE], false,
      completedEvents(iso(17), 178)),
    makeSession("fp-012", 16, 445, [BRICK_MODERN, MORTAR_WHITE, BOND_WILD], false,
      completedEvents(iso(16), 445)),

    // ── Day 7-14: Steady traffic ───────────────────────────────
    makeSession("fp-013", 14, 134, [BRICK_RUSTIKAL, MORTAR_ANTRAC], false,
      completedEvents(iso(14), 134)),
    makeSession("fp-014", 13, 52, [BRICK_ANTIK, MORTAR_GREY], true,
      abandonedEvents(iso(13))),
    makeSession("fp-015", 12, 378, [BRICK_RUSTIKAL, MORTAR_WHITE, BOND_WILD], false,
      completedEvents(iso(12), 378)),
    makeSession("fp-016", 10, 223, [BRICK_MODERN, MORTAR_WHITE], false,
      completedEvents(iso(10), 223)),
    makeSession("fp-017", 9, 101, [BRICK_NATURAL, MORTAR_ANTRAC], true,
      abandonedEvents(iso(9))),
    makeSession("fp-018", 8, 289, [BRICK_RUSTIKAL, MORTAR_GREY, BOND_FLEMISH], false,
      completedEvents(iso(8), 289)),

    // ── Last 7 days: Recent traffic ────────────────────────────
    makeSession("fp-019", 6, 167, [BRICK_ANTIK, MORTAR_WHITE], false,
      completedEvents(iso(6), 167)),
    makeSession("fp-020", 5, 412, [BRICK_RUSTIKAL, BRICK_MODERN, MORTAR_WHITE, BOND_WILD], false,
      completedEvents(iso(5), 412)),
    makeSession("fp-021", 4, 78, [BRICK_MODERN, MORTAR_ANTRAC], true,
      abandonedEvents(iso(4))),
    makeSession("fp-022", 3, 356, [BRICK_RUSTIKAL, MORTAR_WHITE, BOND_FLEMISH], false,
      completedEvents(iso(3), 356)),
    makeSession("fp-023", 2, 199, [BRICK_ANTIK, MORTAR_WHITE, BOND_WILD], false,
      completedEvents(iso(2), 199)),
    makeSession("fp-024", 1, 88, [BRICK_NATURAL, MORTAR_GREY], true,
      abandonedEvents(iso(1))),
    makeSession("fp-025", 0, 445, [BRICK_MODERN, MORTAR_WHITE, BOND_WILD], false,
      completedEvents(iso(0), 445)),
    // BRICK_LOFT and BOND_RUNNER are intentionally never in any session
  ];

  // ── MDM Attributes (62 entries across 5 types) ────────────
  // -- MDM Attributes (62 entries across 5 types) --
  // Each group sorted by sortOrder asc (matches UI dropdown order).
  const ATTR_ADMIN = ADMIN_ID;

  function makeAttr(
    type: GlobalAttribute["type"],
    label: string,
    sortOrder: number,
    meta: string | null = null
  ): GlobalAttribute {
    return {
      id: randomUUID(),
      type,
      label,
      meta,
      sortOrder,
      active: true,
      createdAt: iso(60),
      updatedAt: iso(60),
      createdBy: ATTR_ADMIN,
    };
  }

  const attributes: GlobalAttribute[] = [
    // COLORS (13)
    makeAttr("color", "Biela",             1),
    makeAttr("color", "Kremova",           2),
    makeAttr("color", "Bezova",            3),
    makeAttr("color", "Okrova",            4),
    makeAttr("color", "Tehlova",           5),
    makeAttr("color", "Cervena",           6),
    makeAttr("color", "Tmavocervena",      7),
    makeAttr("color", "Hneda",             8),
    makeAttr("color", "Seda",              9),
    makeAttr("color", "Svetloseda",       10),
    makeAttr("color", "Antracitova",      11),
    makeAttr("color", "Cierna",           12),
    makeAttr("color", "Fialova glazura",  13),

    // MANUFACTURERS (9)
    makeAttr("manufacturer", "Wienerberger",      1),
    makeAttr("manufacturer", "Tondach",           2),
    makeAttr("manufacturer", "Roben",             3),
    makeAttr("manufacturer", "Baumit",            4),
    makeAttr("manufacturer", "Mapei",             5),
    makeAttr("manufacturer", "Klinker Keram",     6),
    makeAttr("manufacturer", "Feldhaus Klinker",  7),
    makeAttr("manufacturer", "Vandersanden",      8),
    makeAttr("manufacturer", "Heluz",             9),

    // STRUCTURES (8)
    makeAttr("structure", "Hladka",      1),
    makeAttr("structure", "Rustikalna",  2),
    makeAttr("structure", "Antik",       3),
    makeAttr("structure", "Loft",        4),
    makeAttr("structure", "Glazovana",   5),
    makeAttr("structure", "Pieskovita",  6),
    makeAttr("structure", "Stiepena",    7),
    makeAttr("structure", "Valcovana",   8),

    // FORMATS (20)
    makeAttr("format", "NF - 240 x 71 x 115 mm",           1, '{"norm":"NF","widthMm":240,"heightMm":71,"depthMm":115}'),
    makeAttr("format", "DF - 240 x 52 x 115 mm",           2, '{"norm":"DF","widthMm":240,"heightMm":52,"depthMm":115}'),
    makeAttr("format", "WDF - 210 x 65 x 100 mm",          3, '{"norm":"WDF","widthMm":210,"heightMm":65,"depthMm":100}'),
    makeAttr("format", "WF - 210 x 65 x 102 mm",           4, '{"norm":"WF","widthMm":210,"heightMm":65,"depthMm":102}'),
    makeAttr("format", "RF - 250 x 65 x 120 mm",           5, '{"norm":"RF","widthMm":250,"heightMm":65,"depthMm":120}'),
    makeAttr("format", "RF90 - 290 x 90 x 140 mm",         6, '{"norm":"RF90","widthMm":290,"heightMm":90,"depthMm":140}'),
    makeAttr("format", "NF14 - 290 x 71 x 115 mm",         7, '{"norm":"NF14","widthMm":290,"heightMm":71,"depthMm":115}'),
    makeAttr("format", "DF14 - 290 x 52 x 115 mm",         8, '{"norm":"DF14","widthMm":290,"heightMm":52,"depthMm":115}'),
    makeAttr("format", "Rucny format - 220 x 73 x 55 mm",  9, '{"norm":"HF","widthMm":220,"heightMm":73,"depthMm":55}'),
    makeAttr("format", "Plato 250 x 120 mm",               10, '{"norm":"PLATO250","widthMm":250,"heightMm":120,"depthMm":30}'),
    makeAttr("format", "Plato 290 x 140 mm",               11, '{"norm":"PLATO290","widthMm":290,"heightMm":140,"depthMm":30}'),
    makeAttr("format", "Paska 240 x 52 x 10 mm",           12, '{"norm":"STRIP240","widthMm":240,"heightMm":52,"depthMm":10}'),
    makeAttr("format", "Paska 240 x 71 x 10 mm",           13, '{"norm":"STRIP240NF","widthMm":240,"heightMm":71,"depthMm":10}'),
    makeAttr("format", "Paska 290 x 71 x 10 mm",           14, '{"norm":"STRIP290","widthMm":290,"heightMm":71,"depthMm":10}'),
    makeAttr("format", "Rohovy format 290 x 240 x 71 mm",  15, '{"norm":"CORNER","widthMm":290,"heightMm":71,"depthMm":240}'),
    makeAttr("format", "Bosa tehla 250 x 120 x 65 mm",     16, '{"norm":"BOSA","widthMm":250,"heightMm":65,"depthMm":120}'),
    makeAttr("format", "Klinker 240 x 71 x 11.5 mm",       17, '{"norm":"KLINKER","widthMm":240,"heightMm":71,"depthMm":12}'),
    makeAttr("format", "Velkoformat 360 x 120 x 71 mm",    18, '{"norm":"LF","widthMm":360,"heightMm":71,"depthMm":120}'),
    makeAttr("format", "Licovka 250 x 65 x 85 mm",         19, '{"norm":"LICOVKA","widthMm":250,"heightMm":65,"depthMm":85}'),
    makeAttr("format", "Exterierova doska 600 x 300 mm",   20, '{"norm":"EXTBOARD","widthMm":600,"heightMm":300,"depthMm":20}'),

    // PRICE LEVELS (5)
    makeAttr("priceLevel", "Economy",    1),
    makeAttr("priceLevel", "Standard",   2),
    makeAttr("priceLevel", "Premium",    3),
    makeAttr("priceLevel", "Luxury",     4),
    makeAttr("priceLevel", "Exclusive",  5),
  ];

  // Marketing & SEO singleton – sensible dev defaults; fill in real IDs before going live
  const marketingSettings: MarketingSettings = {
    ...DEFAULT_MARKETING_SETTINGS,
    seoTitle:       "FABRICK – Konfigurujte si fasádu na mieru",
    seoDescription: "Interaktívny konfigurátor lícových tehál. Vyberte si farbu, štruktúru a väzbu priamo online.",
    updatedAt:      iso(0), // set to seed timestamp
  };

  return { users, products, contacts, sessions, attributes, marketingSettings };
}

// ─────────────────────────────────────────────────────────────
// Expected popularity scores (for test assertion reference)
// ─────────────────────────────────────────────────────────────
export const EXPECTED_SCORES: Record<string, { sessionViews: number; combinationSaves: number; totalScore: number }> = {
  "Rustikálna červená":  { sessionViews: 8,  combinationSaves: 5, totalScore: 13 },
  "Biela 10mm":          { sessionViews: 6,  combinationSaves: 4, totalScore: 10 },
  "Moderná šedá":        { sessionViews: 5,  combinationSaves: 3, totalScore: 8  },
  "Divoká väzba":        { sessionViews: 4,  combinationSaves: 3, totalScore: 7  },
  "Antická biela":       { sessionViews: 4,  combinationSaves: 2, totalScore: 6  },
  "Antracitová 10mm":    { sessionViews: 3,  combinationSaves: 2, totalScore: 5  },
  "Prírodná hnedá":      { sessionViews: 2,  combinationSaves: 1, totalScore: 3  },
  "Svetlo šedá 12mm":    { sessionViews: 2,  combinationSaves: 1, totalScore: 3  },
  "Flámska väzba":       { sessionViews: 2,  combinationSaves: 1, totalScore: 3  },
  "Loft čierna":         { sessionViews: 0,  combinationSaves: 0, totalScore: 0  },
  "Behúňová väzba":      { sessionViews: 0,  combinationSaves: 0, totalScore: 0  },
};
