import puppeteer from "puppeteer-core";
import fs from "fs";
import prisma from "@/lib/prisma";

export interface PdfGeneratePayload {
  /** Voliteľný: kód PDF šablóny; default = 'SALES_QUOTE_DEFAULT' */
  templateCode?: string;
  // ── Produkt ────────────────────────────────────────────────────────────────
  brickName: string;
  brickFormat?: string;
  manufacturer?: string;
  articleCode?: string;
  dimensions?: string;
  price?: string;
  // ── Konfigurácia ───────────────────────────────────────────────────────────
  patternName?: string;
  jointColor?: string;
  jointThickness?: string;
  jointProfile?: string;
  minOrderWarning?: string;
  /** Base64 zachytené z frontend 3D canvasu */
  patternBase64?: string;
  /** Cesta k miniatúre tehly */
  brickThumbUrl?: string;
  /** base64 data URI loga FABRICK SK (ak nie, použije sa prázdny string) */
  fabrickLogoBase64?: string;
  // ── Kontakt zákazníka ──────────────────────────────────────────────────────
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  city?: string;
}

/** Zistí cestu k Chromiu – Alpine Docker vs. Windows lokál */
export function getChromiumExecutablePath(): string {
  // Docker Alpine: nastavené cez ENV v Dockerfile
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  // Windows lokálny vývoj: Chrome alebo Chromium z bežných ciest
  const winPaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Chromium\\Application\\chrome.exe",
  ];
  for (const p of winPaths) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("fs").accessSync(p);
      return p;
    } catch {
      // súbor neexistuje, skúsime ďalší
    }
  }
  throw new Error(
    "Chromium / Chrome nebol nájdený. Nastav PUPPETEER_EXECUTABLE_PATH alebo nainštaluj Chrome."
  );
}

/** Nahradí {{placeholder}} reálnou hodnotou; neznáme placeholdre ponechá prázdne */
export function injectVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    return vars[key] ?? "";
  });
}

/** 
 * Stiahne obrázok z absolútnej URL a vráti ho ako Base64 data URI.
 * Ak zlyhá (napr. 404), vráti prázdny reťazec a do konzoly vypíše varovanie.
 */
export async function fetchImageAsBase64(url: string | undefined, fallbackMime = "image/png"): Promise<string> {
  if (!url) return "";
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[PDF Generate] Failed to fetch image: ${url} (Status: ${res.status})`);
      return "";
    }
    const contentType = res.headers.get("content-type");
    const mimeType = contentType && contentType.startsWith("image/") ? contentType : fallbackMime;
    const buffer = await res.arrayBuffer();
    return `data:${mimeType};base64,${Buffer.from(buffer).toString("base64")}`;
  } catch (err) {
    console.warn(`[PDF Generate] Error fetching image ${url}:`, err);
    return "";
  }
}

export async function generatePdfBuffer(body: PdfGeneratePayload): Promise<Buffer> {
  // ── 2. Načítanie šablóny z DB ──────────────────────────────────────────────
  const templateCode = body.templateCode ?? "CONFIGURATION_OVERVIEW";
  let template: { bodyHtml: string; cssStyles: string | null } | null = null;

  try {
    template = await prisma.pdfTemplate.findUnique({
      where: { code: templateCode },
      select: { bodyHtml: true, cssStyles: true },
    });
  } catch (dbError) {
    console.error("[PDF Generate] DB lookup failed:", dbError);
    throw new Error("DB_ERROR");
  }

  if (!template) {
    throw new Error("TEMPLATE_NOT_FOUND");
  }

  // ── 3. Príprava premenných ─────────────────────────────────────────────────
  const now = new Date().toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // ── 3.5 Načítanie obrázkov z absolútnych URL ──────────────────────────────
  const brickThumbBase64 = await fetchImageAsBase64(body.brickThumbUrl, "image/webp");

  // ── 3.6 Načítanie zachyteného canvasu z frontendu ─────────────────────────
  const patternBase64 = body.patternBase64 ?? "";
  const vars: Record<string, string> = {
    brickName:      body.brickName ?? "",
    brickFormat:    body.brickFormat ?? "",
    manufacturer:   body.manufacturer ?? "",
    articleCode:    body.articleCode ?? "",
    dimensions:     body.dimensions ?? "",
    price:          body.price ?? "",
    patternName:    body.patternName ?? "",
    jointColor:     body.jointColor ?? "",
    jointThickness: body.jointThickness ?? "",
    jointProfile:   body.jointProfile ?? "",
    minOrderWarning: body.minOrderWarning ?? "",
    firstName:      body.firstName ?? "",
    lastName:       body.lastName ?? "",
    email:          body.email ?? "",
    phone:          body.phone ?? "",
    company:        body.company ?? "",
    city:           body.city ?? "",
    date:           now,
    brickThumbImg:  brickThumbBase64,
    patternImg:     patternBase64,
    fabrickLogoImg: body.fabrickLogoBase64 ?? "",
  };

  // ── 4. Injekcia premenných do šablóny ─────────────────────────────────────
  const hydratedHtml = injectVariables(template.bodyHtml, vars);
  const cssStyles = template.cssStyles ?? "";

  // Zostrojíme kompletný HTML dokument: CSS vložíme do <head> ak tam ešte nie je
  let fullHtml: string;
  if (hydratedHtml.includes("<head>") || hydratedHtml.includes("<HEAD>")) {
    // šablóna má vlastný <head>, injektujeme CSS pred </head>
    fullHtml = hydratedHtml.replace(
      /<\/head>/i,
      `<style>${cssStyles}</style></head>`
    );
  } else {
    // šablóna je fragment – obalíme
    fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${cssStyles}</style></head><body>${hydratedHtml}</body></html>`;
  }

  // ── 5. Puppeteer – generovanie PDF v RAM ──────────────────────────────────
  let pdfBuffer: Buffer;
  let browser = null;

  try {
    const executablePath = getChromiumExecutablePath();

    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",          // dôležité pre Alpine / Docker prostredie
      ],
    });

    const page = await browser.newPage();

    // Nastavíme HTML content priamo (nie navigate na URL), zdroj: "about:blank"
    await page.setContent(fullHtml, { waitUntil: "load" });
    
    // Vyčkáme na dotiahnutie všetkých obrázkov a assetov
    await page.evaluate(async () => {
      const selectors = Array.from(document.querySelectorAll("img"));
      await Promise.all(
        selectors.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.addEventListener("load", resolve);
            img.addEventListener("error", resolve);
          });
        })
      );
    });

    // Generovanie PDF v pamäti – žiadne zapisovanie na disk
    const pdfRaw = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    // page.pdf() vracia Uint8Array; prekonvertujeme na Buffer pre byteLength a Response
    pdfBuffer = Buffer.from(pdfRaw.buffer, pdfRaw.byteOffset, pdfRaw.byteLength);
    return pdfBuffer;
  } catch (puppeteerError) {
    console.error("[PDF Generate] Puppeteer error:", puppeteerError);
    throw new Error("PDF_GENERATION_FAILED");
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
