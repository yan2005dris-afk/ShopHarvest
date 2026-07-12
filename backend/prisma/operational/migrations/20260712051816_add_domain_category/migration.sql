-- DropIndex
DROP INDEX "idx_brand_name_trgm";

-- AlterTable
ALTER TABLE "DomainRule" ADD COLUMN     "category" TEXT;
