import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const patterns = [
  { name: "Behúňová", code: "stretcher" },
  { name: "Divoká", code: "wild" },
  { name: "Vojenská", code: "military" },
  { name: "Stojatá", code: "soldier" },
  { name: "Flámska", code: "flemish" },
  { name: "Krížová", code: "cross" },
  { name: "Basketweave Modular", code: "basketweave_modular" }
];

async function main() {
  console.log("Seeding patterns...");

  for (const pattern of patterns) {
    await prisma.patternConfig.upsert({
      where: { code: pattern.code },
      update: { name: pattern.name },
      create: {
        name: pattern.name,
        code: pattern.code,
        isActive: true,
      },
    });
  }

  const allCodes = patterns.map(p => p.code);
  const jsonCodes = JSON.stringify(allCodes);

  console.log("Updating all FormatConfigs with allowedPatterns...");
  
  await prisma.formatConfig.updateMany({
    data: {
      allowedPatterns: jsonCodes
    }
  });

  // Cleanup old incorrectly seeded patterns if they exist
  const oldCodes = ["behunova", "divoka", "vojenska", "stojata", "flamska", "krizova", "basketweave"];
  await prisma.patternConfig.deleteMany({
    where: { code: { in: oldCodes } }
  });

  console.log("Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
