-- Fase 1a — Modelo Operacional
-- Source, Category, Brand, and RawCapture entities for structured scraping
-- source management.

-- Enable pg_trgm extension for fuzzy brand matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "source_status" AS ENUM ('inactive', 'active', 'error');

-- CreateTable: sources
CREATE TABLE "sources" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "status" "source_status" NOT NULL DEFAULT 'inactive',
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable: categories
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" UUID,
    "path" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: category_source_mappings
CREATE TABLE "category_source_mappings" (
    "categoryId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "remoteCode" TEXT NOT NULL,

    CONSTRAINT "category_source_mappings_pkey" PRIMARY KEY ("categoryId", "sourceId")
);

-- CreateTable: brands
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable: raw_captures
CREATE TABLE "raw_captures" (
    "offerId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "capturedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_captures_pkey" PRIMARY KEY ("offerId", "sourceId")
);

-- CreateIndex: unique source code
CREATE UNIQUE INDEX "sources_code_key" ON "sources"("code");

-- CreateIndex: category tree support
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");
CREATE INDEX "categories_path_idx" ON "categories"("path");

-- CreateIndex: unique brand name
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex: GIN index on brand aliases array for pg_trgm similarity
CREATE INDEX "brands_aliases_idx" ON "brands" USING GIN ("aliases");

-- CreateIndex: pg_trgm GiST index on brand name for fuzzy matching
CREATE INDEX "idx_brand_name_trgm" ON "brands" USING GIST ("name" gist_trgm_ops);

-- pg_trgm gin_trgm_ops requires a single text column; aliases is a text[]
-- array. Fuzzy matching on aliases is handled application-side by expanding
-- each alias as a separate similarity query against the `name` column,
-- which has the gist_trgm_ops index.

-- CreateIndex: raw capture temporal index
CREATE INDEX "raw_captures_capturedAt_idx" ON "raw_captures"("capturedAt");

-- AddForeignKey: category self-referencing parent
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: category_source_mappings → categories
ALTER TABLE "category_source_mappings" ADD CONSTRAINT "category_source_mappings_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: category_source_mappings → sources
ALTER TABLE "category_source_mappings" ADD CONSTRAINT "category_source_mappings_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: raw_captures → sources
ALTER TABLE "raw_captures" ADD CONSTRAINT "raw_captures_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
