-- CreateTable
CREATE TABLE "DomainRule" (
    "id" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "selectorTitle" TEXT NOT NULL,
    "selectorPrice" TEXT NOT NULL,
    "selectorImage" TEXT,
    "selectorSku" TEXT,
    "selectorType" TEXT NOT NULL DEFAULT 'css',
    "paginationType" TEXT NOT NULL DEFAULT 'scroll',
    "paginationSelector" TEXT,
    "sampleUrl" TEXT,
    "lastScrapedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "domainRuleId" UUID NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "imageUrl" TEXT,
    "productUrl" TEXT NOT NULL,
    "sku" TEXT,
    "description" TEXT,
    "rawData" JSONB,
    "extractedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DomainRule_domain_key" ON "DomainRule"("domain");

-- CreateIndex
CREATE INDEX "Product_domainRuleId_idx" ON "Product"("domainRuleId");

-- CreateIndex
CREATE INDEX "Product_externalId_idx" ON "Product"("externalId");

-- CreateIndex
CREATE INDEX "Product_productUrl_idx" ON "Product"("productUrl");

-- CreateIndex
CREATE INDEX "PriceHistory_productId_idx" ON "PriceHistory"("productId");

-- CreateIndex
CREATE INDEX "PriceHistory_capturedAt_idx" ON "PriceHistory"("capturedAt");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_domainRuleId_fkey" FOREIGN KEY ("domainRuleId") REFERENCES "DomainRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
