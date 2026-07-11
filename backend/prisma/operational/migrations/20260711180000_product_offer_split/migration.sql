-- product-offer-split
-- Splits the flat "Product"/"PriceHistory" tables into canonical "Product"
-- + "Offer" (product-at-a-site) + "PriceObservation" (price series off
-- Offer), per docs/pendiente/DISENO-modelo-datos-2db.md §3.1. Greenfield —
-- no production data in Product/PriceHistory, so this is a clean
-- drop+recreate (no data-preserving transform).
--
-- Hand-written: `prisma migrate dev` cannot rebuild its shadow database
-- here (pre-existing, unrelated bug replaying migration
-- 20260616220000_add_visual_mapper_fields — same workaround as
-- fix-analytics-db-wiring / chore/remove-etl-product). Apply with
-- `prisma migrate deploy` (no shadow DB) instead of `migrate dev`.

-- DropForeignKey: old flat Product -> DomainRule
ALTER TABLE "Product" DROP CONSTRAINT "Product_domainRuleId_fkey";

-- DropForeignKey: old PriceHistory -> Product
ALTER TABLE "PriceHistory" DROP CONSTRAINT "PriceHistory_productId_fkey";

-- DropTable: price series now lives on PriceObservation (off Offer)
DROP TABLE "PriceHistory";

-- DropTable: flat Product replaced by canonical Product + Offer
DROP TABLE "Product";

-- AlterTable: DomainRule -> Source bridge (Decision 1, design.md).
-- Nullable: no migration-time backfill: the extension only ever sends
-- `dto.domain`, so `ingestFromExtension` resolves/upserts a Source and
-- backfills this FK live, per ingest.
ALTER TABLE "DomainRule" ADD COLUMN "sourceId" UUID;

-- CreateTable: Product (canonical identity only)
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "categoryId" UUID,
    "brandId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Offer (product-at-a-site; 1 ingested item = 1 Offer, no dedup)
CREATE TABLE "Offer" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "domainRuleId" UUID,
    "externalId" TEXT,
    "url" TEXT NOT NULL,
    "sku" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "price" DECIMAL(12,2) NOT NULL,
    "rawData" JSONB,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PriceObservation (replaces PriceHistory; hangs off Offer)
CREATE TABLE "PriceObservation" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Product category/brand lookups (unpopulated FK columns)
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex: Offer uniqueness per (source, url) + lookups
CREATE UNIQUE INDEX "Offer_sourceId_url_key" ON "Offer"("sourceId", "url");
CREATE INDEX "Offer_productId_idx" ON "Offer"("productId");
CREATE INDEX "Offer_sourceId_idx" ON "Offer"("sourceId");
CREATE INDEX "Offer_externalId_idx" ON "Offer"("externalId");

-- CreateIndex: PriceObservation temporal/lookup indexes
CREATE INDEX "PriceObservation_offerId_idx" ON "PriceObservation"("offerId");
CREATE INDEX "PriceObservation_observedAt_idx" ON "PriceObservation"("observedAt");

-- AddForeignKey: DomainRule -> Source bridge
ALTER TABLE "DomainRule" ADD CONSTRAINT "DomainRule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Offer -> Product (cascade: deleting a Product deletes its Offers)
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Offer -> Source (Offer.sourceId is always resolved before write)
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: Offer -> DomainRule (nullable, extraction lineage)
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_domainRuleId_fkey" FOREIGN KEY ("domainRuleId") REFERENCES "DomainRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: PriceObservation -> Offer (cascade: deleting an Offer deletes its price series)
ALTER TABLE "PriceObservation" ADD CONSTRAINT "PriceObservation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Product -> Category (schema-only, unpopulated in this change)
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Product -> Brand (schema-only, unpopulated in this change)
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: RawCapture -> Offer (closes the orphan-model gap flagged in
-- exploration.md — offerId previously had no referential integrity)
ALTER TABLE "raw_captures" ADD CONSTRAINT "raw_captures_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
