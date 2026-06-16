import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

async function main() {
  console.log("Loading Excel file...");
  const filePath = "d:/Antigravity/Fabrick-Core/brick-generator/tools/FABRICK zoznam produktov.xlsx";
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Použijeme header: "A", range: 1 preskočí prvý riadok s hlavičkami
  const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: "A", range: 1 });
  
  console.log("Loading Configs and Products...");
  const rules = await prisma.priceLevelConfig.findMany({
    orderBy: { minPrice: 'asc' }
  });

  const products = await prisma.product.findMany();
  
  let updatedCount = 0;

  for (const row of data) {
    const productName = row['M'];
    const exactPriceStr = row['AL'];
    const articleCode1 = row['H'];
    const articleCode2 = row['Q'];
    const brickerCode = row['G'];
    const klinkerNr = row['A'];
    
    if (!productName || !exactPriceStr || exactPriceStr === '-') continue;

    const parsedPrice = parseFloat(String(exactPriceStr).replace(',', '.').trim());
    if (isNaN(parsedPrice)) continue;

    const matchedProduct = products.find(p => 
      (p.name && String(productName).toLowerCase().trim() !== "" && p.name.toLowerCase().includes(String(productName).toLowerCase().trim())) ||
      (p.articleCode && p.articleCode !== "" && (p.articleCode === articleCode1 || p.articleCode === articleCode2)) ||
      (p.code && p.code !== "" && (p.code === brickerCode || p.code === klinkerNr))
    );

    if (matchedProduct && !matchedProduct.isManualPriceOverride) {
      let matchedRuleId: string | null = null;
      for (const rule of rules) {
        if (parsedPrice >= rule.minPrice && parsedPrice <= rule.maxPrice) {
          matchedRuleId = rule.id;
          break;
        }
      }

      await prisma.product.update({
        where: { id: matchedProduct.id },
        data: {
          exactPrice: parsedPrice,
          priceLevelId: matchedRuleId,
        }
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated prices and price rules for ${updatedCount} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
