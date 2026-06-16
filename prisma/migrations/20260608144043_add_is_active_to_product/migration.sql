-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL DEFAULT '',
    "articleCode" TEXT NOT NULL DEFAULT '',
    "formatLabel" TEXT NOT NULL DEFAULT '',
    "dimensions" TEXT NOT NULL DEFAULT '',
    "bricksPerM2" TEXT NOT NULL DEFAULT '',
    "structure" TEXT,
    "exactPrice" REAL,
    "priceLevel" INTEGER,
    "dominantnaFarba" TEXT NOT NULL DEFAULT '',
    "colors" TEXT NOT NULL DEFAULT '[]',
    "colorBreakdown" TEXT NOT NULL DEFAULT '{}',
    "analyzedImages" INTEGER NOT NULL DEFAULT 0,
    "svetlostIndex" REAL NOT NULL DEFAULT 0,
    "productType" TEXT,
    "object" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("analyzedImages", "articleCode", "bricksPerM2", "code", "colorBreakdown", "colors", "createdAt", "dimensions", "dominantnaFarba", "exactPrice", "formatLabel", "id", "manufacturer", "name", "object", "priceLevel", "productType", "structure", "svetlostIndex", "updatedAt") SELECT "analyzedImages", "articleCode", "bricksPerM2", "code", "colorBreakdown", "colors", "createdAt", "dimensions", "dominantnaFarba", "exactPrice", "formatLabel", "id", "manufacturer", "name", "object", "priceLevel", "productType", "structure", "svetlostIndex", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");
CREATE INDEX "Product_manufacturer_idx" ON "Product"("manufacturer");
CREATE INDEX "Product_dominantnaFarba_idx" ON "Product"("dominantnaFarba");
CREATE INDEX "Product_priceLevel_idx" ON "Product"("priceLevel");
CREATE INDEX "Product_isActive_idx" ON "Product"("isActive");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
