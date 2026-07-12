-- AlterTable: add description and defaultFieldMappings to categories
ALTER TABLE "categories" ADD COLUMN "description" TEXT;
ALTER TABLE "categories" ADD COLUMN "defaultFieldMappings" JSONB;

-- CreateIndex: unique constraint on categories.name
-- Safe because the table is empty in dev; future code ensures unique names.
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- Revert the free-string `category` column on DomainRule (was added by
-- 20260712051816_add_domain_category) and replace with a FK to categories.
ALTER TABLE "DomainRule" DROP COLUMN "category";
ALTER TABLE "DomainRule" ADD COLUMN "categoryId" UUID;
ALTER TABLE "DomainRule" ADD CONSTRAINT "DomainRule_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
