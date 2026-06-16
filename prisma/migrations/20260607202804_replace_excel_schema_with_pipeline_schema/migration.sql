-- CreateTable
CREATE TABLE "Product" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Texture" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Texture_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_manufacturer_idx" ON "Product"("manufacturer");

-- CreateIndex
CREATE INDEX "Product_dominantnaFarba_idx" ON "Product"("dominantnaFarba");

-- CreateIndex
CREATE INDEX "Product_priceLevel_idx" ON "Product"("priceLevel");

-- CreateIndex
CREATE INDEX "Texture_productId_idx" ON "Texture"("productId");

-- CreateIndex
CREATE INDEX "Texture_type_idx" ON "Texture"("type");
