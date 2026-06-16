/**
 * seed-from-json.ts
 * ─────────────────
 * Naplní Prisma DB z výstupu Python pipeline:
 *   brick-generator/tools/output_bricks/configurator_database.json
 *
 * Stratégia: DELETE všetkých existujúcich produktov + INSERT zo JSON.
 * Bezpečné opakovanie — idempotentné vďaka DELETE → INSERT cyklu.
 *
 * Spustenie:
 *   npm run seed:json
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// ── Cesta k JSON súboru (relatívna od fabrick-admin-panel/) ─────────────────
// Výstup Python pipeline generate_db.py
const JSON_PATH = path.resolve(
  __dirname,
  '../../brick-generator/tools/output_bricks/configurator_database.json'
)

interface PipelineProduct {
  code:             string
  manufacturer:     string
  name:             string
  articleCode:      string
  structure:        string | null
  productType:      string | null
  object:           string | null
  formatLabel:      string
  dimensions:       string
  bricksPerM2:      string
  exactPrice:       number | null
  priceLevel:       number | string | null  // JSON môže byť Int (1-4) ALEBO String ("€€€")
  Dominantna_farba: string
  colors:           string[]
  colorBreakdown:   Record<string, number>
  analyzedImages:   number
  Svetlost_index:   number
}

/**
 * Konvertuje priceLevel na Int (1–4) bez ohľadu na to, či je vstup číslo alebo €-symbol.
 * JSON z generate_db.py vracia Int, ale JSON zo sync_database.py vracia "€€€".
 */
function priceLevelToInt(val: number | string | null | undefined): number | null {
  if (val == null) return null
  if (typeof val === 'number') return (val >= 1 && val <= 4) ? val : null
  // String konverzia: "€" → 1, "€€" → 2, "€€€" → 3, "€€€€" → 4
  const euroMap: Record<string, number> = { '€': 1, '€€': 2, '€€€': 3, '€€€€': 4 }
  const cleaned = String(val).trim()
  if (cleaned in euroMap) return euroMap[cleaned]
  // Fallback: pokus o parseInt (napr. "2")
  const parsed = parseInt(cleaned, 10)
  return isNaN(parsed) ? null : parsed
}


async function main() {
  console.log('\n══════════════════════════════════════════════════════')
  console.log('  SEED-FROM-JSON: Python pipeline → Prisma DB')
  console.log('══════════════════════════════════════════════════════')
  console.log(`\n📂  Načítavam: ${JSON_PATH}`)

  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(
      `Súbor nebol nájdený: ${JSON_PATH}\n` +
      `Spusti najprv: 1_PRIPRAVA_DAT.bat (alebo 1.5_AKTUALIZACIA_DATABAZY.bat)\n` +
      `a skontroluj, že existuje: tools/output_bricks/configurator_database.json`
    )
  }

  const raw = fs.readFileSync(JSON_PATH, 'utf-8')
  const products: PipelineProduct[] = JSON.parse(raw)

  console.log(`✅  Načítaných produktov zo JSON: ${products.length}`)

  // ── 1. Vymazanie existujúcich dát (Texture cascaduje automaticky) ──────────
  console.log(`\n🗑️   Mažem existujúce záznamy z DB...`)
  const deletedTextures = await prisma.texture.deleteMany({})
  const deletedProducts = await prisma.product.deleteMany({})
  console.log(`     Vymazaných: ${deletedProducts.count} produktov, ${deletedTextures.count} textúr`)

  // ── 2. Filtrácia a vkladanie ───────────────────────────────────────────────
  console.log(`\n⬆️   Vkladám produkty do DB...\n`)

  let ok = 0
  let skip = 0
  const skipped: string[] = []

  for (const p of products) {
    // Preskočiť záznamy bez kódu (napr. "Základný adresár" — iba root webp)
    if (!p.code || p.code.trim() === '' || p.code === 'Základný adresár') {
      console.warn(`  ⚠️  Preskočený: "${p.code || '(prázdny kód)'}" — ${p.name}`)
      skip++
      skipped.push(p.code || '(prázdny kód)')
      continue
    }

    try {
      await prisma.product.create({
        data: {
          code:            p.code.trim(),
          name:            p.name            || '',
          manufacturer:    p.manufacturer    || '',
          articleCode:     p.articleCode     || p.code,
          formatLabel:     p.formatLabel     || '',
          dimensions:      p.dimensions      || '',
          bricksPerM2:     p.bricksPerM2     || '',
          structure:       p.structure       ?? null,
          exactPrice:      p.exactPrice      ?? null,
          // priceLevel sa už do Product netlačí priamo, lebo je tu PriceLevelConfig
          // priceLevel:      priceLevelToInt(p.priceLevel),   // Int | null
          dominantnaFarba: p.Dominantna_farba || '',
          // SQLite nemá natívny Array/JSON typ → serializujeme
          colors:          JSON.stringify(p.colors         || []),
          colorBreakdown:  JSON.stringify(p.colorBreakdown || {}),
          analyzedImages:  p.analyzedImages  ?? 0,
          svetlostIndex:   p.Svetlost_index  ?? 0,
          productType:     p.productType     ?? null,
          object:          p.object          ?? null,
        },
      })

      const priceStr = p.exactPrice ? `${p.exactPrice} €` : '—'
      console.log(
        `  ✓  [${p.code.padEnd(35)}] ${(p.name || '(bez názvu)').padEnd(30)} ` +
        `${p.analyzedImages} fotiek | ${priceStr}`
      )
      ok++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗  [${p.code}] Chyba: ${msg}`)
      skip++
      skipped.push(p.code)
    }
  }

  // ── 3. Záverečná správa ───────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════')
  console.log(`✅  Úspešne vložených: ${ok} produktov`)
  if (skip > 0) {
    console.log(`⚠️   Preskočených:       ${skip}`)
    skipped.forEach(c => console.log(`     • ${c}`))
  }
  console.log('══════════════════════════════════════════════════════\n')

  // ── 4. Rýchle overenie ────────────────────────────────────────────────────
  const total = await prisma.product.count()
  console.log(`🔍  Overenie DB: ${total} produktov v databáze`)

  const sample = await prisma.product.findFirst({ orderBy: { code: 'asc' } })
  if (sample) {
    console.log(`    Prvý záznam: [${sample.code}] ${sample.name} (${sample.manufacturer})`)
  }
  console.log('')
}

main()
  .catch(e => {
    console.error('\n❌ Seed zlyhal:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
