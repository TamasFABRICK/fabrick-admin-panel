import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const REGEX_DIMENSIONS = /(?:-\s*)?(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/;

async function migrateFormats() {
  console.log('Spúšťam migráciu formátov...');
  const products = await prisma.product.findMany({
    where: { formatConfigId: null }
  });

  let migratedCount = 0;
  let skippedCount = 0;

  for (const product of products) {
    if (!product.formatLabel || product.formatLabel.trim() === '') {
      skippedCount++;
      continue;
    }
    
    let width = 0;
    let height = 0;
    let name = product.formatLabel.trim();

    const match = product.formatLabel.match(REGEX_DIMENSIONS);
    if (match) {
      width = parseFloat(match[1]);
      height = parseFloat(match[2]);
      name = product.formatLabel.replace(REGEX_DIMENSIONS, '').replace(/mm/i, '').trim();
      if (name.endsWith('-')) name = name.slice(0, -1).trim();
    } else {
      // Skúsime aspoň vyparsovať dimensions field, ak je
      const dimMatch = product.dimensions ? product.dimensions.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/) : null;
      if (dimMatch) {
        width = parseFloat(dimMatch[1]);
        height = parseFloat(dimMatch[2]);
      }
    }

    try {
      const formatConfig = await prisma.formatConfig.upsert({
        where: { name },
        update: { width, height },
        create: { name, width, height },
      });

      await prisma.product.update({
        where: { id: product.id },
        data: { formatConfigId: formatConfig.id }
      });
      migratedCount++;
    } catch (e) {
      console.error(`Chyba pri migrácii produktu ${product.id} (formát: ${name}):`, e);
      skippedCount++;
    }
  }

  console.log(`Migrácia dokončená. Migrovaných produktov: ${migratedCount}. Preskočených: ${skippedCount}.`);
}

migrateFormats()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
