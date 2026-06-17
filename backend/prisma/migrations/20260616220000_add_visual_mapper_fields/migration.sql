-- AlterTable: DomainRule — add visual mapper columns
ALTER TABLE "DomainRule" 
  ADD COLUMN "fieldMappings" JSONB,
  ADD COLUMN "containerSelector" TEXT,
  ADD COLUMN "productLimit" INTEGER;

-- AlterTable: ScrapingJob — add type column
ALTER TABLE "ScrapingJob"
  ADD COLUMN "type" TEXT NOT NULL DEFAULT 'single';

-- CreateTable: FetchRequest
CREATE TABLE "FetchRequest" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "result" JSONB,
    "errorMessage" TEXT,
    "enqueuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FetchRequest_pkey" PRIMARY KEY ("id")
);
