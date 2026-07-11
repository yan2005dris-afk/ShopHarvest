-- AlterTable
ALTER TABLE "dw"."fact_productos" ADD COLUMN     "id_marca" INTEGER;

-- CreateTable
CREATE TABLE "dw"."dim_marca" (
    "id_marca" SERIAL NOT NULL,
    "nombre_marca" VARCHAR(100) NOT NULL,

    CONSTRAINT "dim_marca_pkey" PRIMARY KEY ("id_marca")
);

-- CreateIndex
CREATE UNIQUE INDEX "dim_marca_nombre_marca_key" ON "dw"."dim_marca"("nombre_marca");

-- AddForeignKey
ALTER TABLE "dw"."fact_productos" ADD CONSTRAINT "fact_productos_id_marca_fkey" FOREIGN KEY ("id_marca") REFERENCES "dw"."dim_marca"("id_marca") ON DELETE SET NULL ON UPDATE CASCADE;
