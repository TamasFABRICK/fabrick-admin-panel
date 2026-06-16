import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

// Cesta k JSON súboru s dátami pre Konfigurátor
const JSON_PATH = path.resolve(
  __dirname,
  '../../brick-generator/public/bricks/configurator_database.json'
)

function priceLevelToInt(val: number | string | null | undefined): number | null {
  if (val == null) return null
  if (typeof val === 'number') return (val >= 1 && val <= 4) ? val : null
  const euroMap: Record<string, number> = { '€': 1, '€€': 2, '€€€': 3, '€€€€': 4 }
  const cleaned = String(val).trim()
  if (cleaned in euroMap) return euroMap[cleaned]
  const parsed = parseInt(cleaned, 10)
  return isNaN(parsed) ? null : parsed
}

async function main() {
  console.log('Spúšťam Prisma migráciu z JSON súboru do SQL (upsert)...')
  console.log(`Načítavam dáta z: ${JSON_PATH}`)

  if (!fs.existsSync(JSON_PATH)) {
    console.error(`Chyba: Súbor sa nenašiel: ${JSON_PATH}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(JSON_PATH, 'utf-8')
  const products = JSON.parse(raw)
  console.log(`Počet nájdených produktov v JSON: ${products.length}`)

  let upsertedCount = 0
  let skippedCount = 0

  for (const p of products) {
    if (!p.code || p.code.trim() === '' || p.code === 'Základný adresár') {
      skippedCount++
      continue
    }

    const dataPayload = {
      name:            p.name            || '',
      manufacturer:    p.manufacturer    || '',
      articleCode:     p.articleCode     || p.code,
      formatLabel:     p.formatLabel     || '',
      dimensions:      p.dimensions      || '',
      bricksPerM2:     p.bricksPerM2     || '',
      structure:       p.structure       ?? null,
      exactPrice:      p.exactPrice      ?? null,
      priceLevel:      priceLevelToInt(p.priceLevel),
      dominantnaFarba: p.Dominantna_farba || '',
      colors:          JSON.stringify(p.colors         || []),
      colorBreakdown:  JSON.stringify(p.colorBreakdown || {}),
      analyzedImages:  p.analyzedImages  ?? 0,
      svetlostIndex:   p.Svetlost_index  ?? 0,
      productType:     p.productType     ?? null,
      object:          p.object          ?? null,
      isActive:        true
    }

    try {
      await prisma.product.upsert({
        where: { code: p.code.trim() },
        update: dataPayload,
        create: {
          code: p.code.trim(),
          ...dataPayload
        }
      })
      upsertedCount++
    } catch (error) {
      console.error(`Chyba pri vkladaní produktu ${p.code}:`, error)
      skippedCount++
    }
  }

  console.log('--- MIGRÁCIA DOKONČENÁ ---')
  console.log(`Úspešne spracované (upsert): ${upsertedCount}`)
  console.log(`Preskočené / Chyby: ${skippedCount}`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
