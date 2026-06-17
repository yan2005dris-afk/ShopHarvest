-- CreateTable
CREATE TABLE "ScrapingSchedule" (
    "id" UUID NOT NULL,
    "domainRuleId" UUID NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrapingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScrapingSchedule_enabled_idx" ON "ScrapingSchedule"("enabled");

-- AddForeignKey
ALTER TABLE "ScrapingSchedule" ADD CONSTRAINT "ScrapingSchedule_domainRuleId_fkey" FOREIGN KEY ("domainRuleId") REFERENCES "DomainRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
