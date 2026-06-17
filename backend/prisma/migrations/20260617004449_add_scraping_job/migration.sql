-- CreateTable
CREATE TABLE "ScrapingJob" (
    "id" UUID NOT NULL,
    "domainRuleId" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "errorMessage" TEXT,
    "result" JSONB,
    "enqueuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapingJob_domainRuleId_idx" ON "ScrapingJob"("domainRuleId");

-- AddForeignKey
ALTER TABLE "ScrapingJob" ADD CONSTRAINT "ScrapingJob_domainRuleId_fkey" FOREIGN KEY ("domainRuleId") REFERENCES "DomainRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
