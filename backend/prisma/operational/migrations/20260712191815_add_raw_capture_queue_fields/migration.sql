-- CreateEnum
CREATE TYPE "RawCaptureStatus" AS ENUM ('UNPROCESSED', 'PROCESSED', 'FAILED');

-- AlterTable
ALTER TABLE "raw_captures" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "RawCaptureStatus" NOT NULL DEFAULT 'UNPROCESSED';

-- CreateIndex
CREATE INDEX "raw_captures_status_attempts_idx" ON "raw_captures"("status", "attempts");
