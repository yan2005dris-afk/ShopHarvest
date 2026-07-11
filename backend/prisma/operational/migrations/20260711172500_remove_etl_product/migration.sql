-- DropForeignKey
ALTER TABLE "EtlProduct" DROP CONSTRAINT "EtlProduct_etlRunId_fkey";

-- DropTable
DROP TABLE "EtlProduct";
