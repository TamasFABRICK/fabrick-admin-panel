import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding PriceLevelConfig...");

  const rules = [
    { name: "€ = do 49€/m²", minPrice: 0, maxPrice: 49.99, currency: "EUR" },
    { name: "€€ = 50-99€/m²", minPrice: 50, maxPrice: 99.99, currency: "EUR" },
    { name: "€€€ = 100-149€/m²", minPrice: 100, maxPrice: 149.99, currency: "EUR" },
    { name: "€€€€ = nad 150€/m²", minPrice: 150, maxPrice: 999999, currency: "EUR" },
  ];

  for (const rule of rules) {
    await prisma.priceLevelConfig.create({
      data: rule,
    });
    console.log(`Created rule: ${rule.name}`);
  }

  console.log("Done seeding PriceLevelConfig.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
