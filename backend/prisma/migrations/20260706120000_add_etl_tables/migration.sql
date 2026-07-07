-- CreateEnum
CREATE TYPE "EtlRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "EtlRun" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "status" "EtlRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "rowsScraped" INTEGER NOT NULL DEFAULT 0,
    "rowsPersisted" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,

    CONSTRAINT "EtlRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtlProduct" (
    "id" UUID NOT NULL,
    "etlRunId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "availability" TEXT,
    "rawJson" JSONB NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EtlProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QualityMetric" (
    "id" UUID NOT NULL,
    "etlRunId" UUID NOT NULL,
    "completenessPct" DECIMAL(5,2) NOT NULL,
    "duplicatesRemoved" INTEGER NOT NULL DEFAULT 0,
    "checks" JSONB NOT NULL,

    CONSTRAINT "QualityMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EtlRun_status_startedAt_idx" ON "EtlRun"("status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "EtlProduct_etlRunId_idx" ON "EtlProduct"("etlRunId");

-- CreateIndex
CREATE INDEX "EtlProduct_sourceId_idx" ON "EtlProduct"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "EtlProduct_source_sourceId_key" ON "EtlProduct"("source", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "QualityMetric_etlRunId_key" ON "QualityMetric"("etlRunId");

-- AddForeignKey
ALTER TABLE "EtlProduct" ADD CONSTRAINT "EtlProduct_etlRunId_fkey" FOREIGN KEY ("etlRunId") REFERENCES "EtlRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QualityMetric" ADD CONSTRAINT "QualityMetric_etlRunId_fkey" FOREIGN KEY ("etlRunId") REFERENCES "EtlRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;