-- fix-analytics-db-wiring: baseline migration for the analytics (DW) database.
--
-- This is the FIRST tracked migration for `backend/prisma/analytics`. The
-- analytics Postgres instance previously only received `prisma db push`
-- runs (no `_prisma_migrations` history), which created 9 empty orphan
-- tables directly under the default `public` schema (no `dw` namespace,
-- no views, no materialized view). This migration:
--
--   1. Drops those empty `public.*` orphan tables (idempotent, safe — they
--      were never referenced by any application code; the schema had no
--      multiSchema config until now).
--   2. Creates the real `dw` schema + the 9 star-schema tables (generated
--      via `prisma migrate diff --from-empty --to-schema`).
--   3. Appends the 5 KPI views + 1 materialized view + its unique index,
--      hand-copied verbatim from
--      docs/entregables/Entregable4_DataWarehouse_Analitica.md (§5,
--      lines 930-1119) — these objects have no Prisma-native
--      representation and must be raw SQL.
--
-- The analytics DB starts EMPTY. No data is copied from the old operational
-- `dw` snapshot (product decision — see
-- openspec/changes/fix-analytics-db-wiring/proposal.md).

-- ─── Step 1: drop db-push orphan tables (empty, unreferenced) ─────────────
DROP TABLE IF EXISTS "public"."dim_producto" CASCADE;
DROP TABLE IF EXISTS "public"."dim_fuente" CASCADE;
DROP TABLE IF EXISTS "public"."dim_categoria" CASCADE;
DROP TABLE IF EXISTS "public"."dim_tiempo" CASCADE;
DROP TABLE IF EXISTS "public"."dim_moneda" CASCADE;
DROP TABLE IF EXISTS "public"."dim_calificacion" CASCADE;
DROP TABLE IF EXISTS "public"."dim_genero" CASCADE;
DROP TABLE IF EXISTS "public"."fact_productos" CASCADE;
DROP TABLE IF EXISTS "public"."fact_encuesta_consumo" CASCADE;

-- ─── Step 2: create the dw schema + 9 star-schema tables ──────────────────
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "dw";

-- CreateTable
CREATE TABLE "dw"."dim_producto" (
    "id_producto" SERIAL NOT NULL,
    "titulo_oferta" VARCHAR(500) NOT NULL,
    "url_producto" TEXT,
    "disponibilidad" VARCHAR(20),

    CONSTRAINT "dim_producto_pkey" PRIMARY KEY ("id_producto")
);

-- CreateTable
CREATE TABLE "dw"."dim_fuente" (
    "id_fuente" SERIAL NOT NULL,
    "nombre_fuente" VARCHAR(50) NOT NULL,
    "tipo_fuente" VARCHAR(30),
    "descripcion" VARCHAR(200),

    CONSTRAINT "dim_fuente_pkey" PRIMARY KEY ("id_fuente")
);

-- CreateTable
CREATE TABLE "dw"."dim_categoria" (
    "id_categoria" SERIAL NOT NULL,
    "nombre_categoria" VARCHAR(50) NOT NULL,
    "descripcion" VARCHAR(200),

    CONSTRAINT "dim_categoria_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "dw"."dim_tiempo" (
    "id_tiempo" SERIAL NOT NULL,
    "fecha_completa" DATE NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "dia" INTEGER NOT NULL,
    "trimestre" INTEGER NOT NULL,
    "nombre_mes" VARCHAR(20) NOT NULL,

    CONSTRAINT "dim_tiempo_pkey" PRIMARY KEY ("id_tiempo")
);

-- CreateTable
CREATE TABLE "dw"."dim_moneda" (
    "id_moneda" SERIAL NOT NULL,
    "codigo_moneda" CHAR(3) NOT NULL,
    "nombre_moneda" VARCHAR(50),
    "simbolo" VARCHAR(5),

    CONSTRAINT "dim_moneda_pkey" PRIMARY KEY ("id_moneda")
);

-- CreateTable
CREATE TABLE "dw"."dim_calificacion" (
    "id_calificacion" SERIAL NOT NULL,
    "nivel" VARCHAR(10) NOT NULL,
    "valor_numerico" INTEGER NOT NULL,

    CONSTRAINT "dim_calificacion_pkey" PRIMARY KEY ("id_calificacion")
);

-- CreateTable
CREATE TABLE "dw"."dim_genero" (
    "id_genero" SERIAL NOT NULL,
    "nombre_genero" VARCHAR(20) NOT NULL,
    "abreviatura" CHAR(1),

    CONSTRAINT "dim_genero_pkey" PRIMARY KEY ("id_genero")
);

-- CreateTable
CREATE TABLE "dw"."fact_productos" (
    "id_hecho" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "id_fuente" INTEGER NOT NULL,
    "id_categoria" INTEGER NOT NULL,
    "id_tiempo" INTEGER NOT NULL,
    "id_moneda" INTEGER NOT NULL,
    "id_calificacion" INTEGER,
    "precio_usd" DECIMAL(12,2),
    "precio_raw" VARCHAR(50),
    "disponibilidad" VARCHAR(20),

    CONSTRAINT "fact_productos_pkey" PRIMARY KEY ("id_hecho")
);

-- CreateTable
CREATE TABLE "dw"."fact_encuesta_consumo" (
    "id_hecho" SERIAL NOT NULL,
    "id_genero" INTEGER NOT NULL,
    "id_sitio_preferido" INTEGER NOT NULL,
    "edad" INTEGER,
    "frecuencia_compra" VARCHAR(20),
    "gasto_promedio_mensual" VARCHAR(20),
    "motivo_compra" VARCHAR(200),

    CONSTRAINT "fact_encuesta_consumo_pkey" PRIMARY KEY ("id_hecho")
);

-- CreateIndex
CREATE UNIQUE INDEX "dim_fuente_nombre_fuente_key" ON "dw"."dim_fuente"("nombre_fuente");

-- CreateIndex
CREATE UNIQUE INDEX "dim_categoria_nombre_categoria_key" ON "dw"."dim_categoria"("nombre_categoria");

-- CreateIndex
CREATE UNIQUE INDEX "dim_tiempo_fecha_completa_key" ON "dw"."dim_tiempo"("fecha_completa");

-- CreateIndex
CREATE UNIQUE INDEX "dim_moneda_codigo_moneda_key" ON "dw"."dim_moneda"("codigo_moneda");

-- CreateIndex
CREATE UNIQUE INDEX "dim_calificacion_nivel_key" ON "dw"."dim_calificacion"("nivel");

-- CreateIndex
CREATE UNIQUE INDEX "dim_genero_nombre_genero_key" ON "dw"."dim_genero"("nombre_genero");

-- CreateIndex
CREATE INDEX "fact_productos_id_fuente_idx" ON "dw"."fact_productos"("id_fuente");

-- CreateIndex
CREATE INDEX "fact_productos_id_categoria_idx" ON "dw"."fact_productos"("id_categoria");

-- CreateIndex
CREATE INDEX "fact_productos_id_tiempo_idx" ON "dw"."fact_productos"("id_tiempo");

-- CreateIndex
CREATE INDEX "fact_productos_precio_usd_idx" ON "dw"."fact_productos"("precio_usd");

-- CreateIndex
CREATE INDEX "fact_encuesta_consumo_id_genero_idx" ON "dw"."fact_encuesta_consumo"("id_genero");

-- CreateIndex
CREATE INDEX "fact_encuesta_consumo_id_sitio_preferido_idx" ON "dw"."fact_encuesta_consumo"("id_sitio_preferido");

-- AddForeignKey
ALTER TABLE "dw"."fact_productos" ADD CONSTRAINT "fact_productos_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "dw"."dim_producto"("id_producto") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."fact_productos" ADD CONSTRAINT "fact_productos_id_fuente_fkey" FOREIGN KEY ("id_fuente") REFERENCES "dw"."dim_fuente"("id_fuente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."fact_productos" ADD CONSTRAINT "fact_productos_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "dw"."dim_categoria"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."fact_productos" ADD CONSTRAINT "fact_productos_id_tiempo_fkey" FOREIGN KEY ("id_tiempo") REFERENCES "dw"."dim_tiempo"("id_tiempo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."fact_productos" ADD CONSTRAINT "fact_productos_id_moneda_fkey" FOREIGN KEY ("id_moneda") REFERENCES "dw"."dim_moneda"("id_moneda") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."fact_productos" ADD CONSTRAINT "fact_productos_id_calificacion_fkey" FOREIGN KEY ("id_calificacion") REFERENCES "dw"."dim_calificacion"("id_calificacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."fact_encuesta_consumo" ADD CONSTRAINT "fact_encuesta_consumo_id_genero_fkey" FOREIGN KEY ("id_genero") REFERENCES "dw"."dim_genero"("id_genero") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dw"."fact_encuesta_consumo" ADD CONSTRAINT "fact_encuesta_consumo_id_sitio_preferido_fkey" FOREIGN KEY ("id_sitio_preferido") REFERENCES "dw"."dim_fuente"("id_fuente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Step 3: KPI views (verbatim from Entregable4_DataWarehouse_Analitica.md §5.1-5.5) ──

-- KPI 1 — Precio Promedio por Categoría
CREATE OR REPLACE VIEW dw.v_kpi_precio_promedio_categoria AS
SELECT
    dc.nombre_categoria AS categoria,
    COUNT(fp.id_hecho)  AS total_productos,
    ROUND(AVG(fp.precio_usd), 2) AS precio_promedio_usd,
    ROUND(MIN(fp.precio_usd), 2) AS precio_minimo,
    ROUND(MAX(fp.precio_usd), 2) AS precio_maximo,
    CONCAT('$', ROUND(AVG(fp.precio_usd), 2)) AS display_kpi
FROM dw.fact_productos fp
JOIN dw.dim_categoria dc ON fp.id_categoria = dc.id_categoria
WHERE fp.precio_usd IS NOT NULL
GROUP BY dc.nombre_categoria
ORDER BY precio_promedio_usd DESC;

-- KPI 2 — Distribución de Productos por Fuente
CREATE OR REPLACE VIEW dw.v_kpi_distribucion_fuentes AS
SELECT
    df.nombre_fuente AS fuente,
    df.tipo_fuente   AS tipo,
    COUNT(fp.id_hecho) AS total_productos,
    ROUND(COUNT(fp.id_hecho) * 100.0 / SUM(COUNT(fp.id_hecho)) OVER(), 1) AS pct_contribucion
FROM dw.fact_productos fp
JOIN dw.dim_fuente df ON fp.id_fuente = df.id_fuente
GROUP BY df.nombre_fuente, df.tipo_fuente
ORDER BY total_productos DESC;

-- KPI 3 — Tasa de Disponibilidad de Información
CREATE OR REPLACE VIEW dw.v_kpi_completitud_datos AS
SELECT
    'Completitud general' AS kpi,
    ROUND(
        SUM(CASE WHEN fp.precio_usd IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(fp.id_hecho),
        1
    ) AS pct_precio_completo,
    ROUND(
        SUM(CASE WHEN fp.id_categoria IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(fp.id_hecho),
        1
    ) AS pct_categoria_asignada,
    ROUND(
        SUM(CASE WHEN fp.id_calificacion IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(fp.id_hecho),
        1
    ) AS pct_calificacion_presente,
    ROUND(
        SUM(CASE WHEN fp.id_categoria IS NOT NULL AND fp.precio_usd IS NOT NULL THEN 1 ELSE 0 END)
        * 100.0 / COUNT(fp.id_hecho),
        1
    ) AS pct_ficha_completa
FROM dw.fact_productos fp;

-- KPI 4 — Rango de Precios por Fuente (Volatilidad)
CREATE OR REPLACE VIEW dw.v_kpi_rango_precios_fuente AS
SELECT
    df.nombre_fuente AS fuente,
    COUNT(fp.precio_usd) AS n,
    ROUND(MIN(fp.precio_usd), 2) AS precio_min,
    ROUND(MAX(fp.precio_usd), 2) AS precio_max,
    ROUND(MAX(fp.precio_usd) - MIN(fp.precio_usd), 2) AS rango_total,
    ROUND(
        (MAX(fp.precio_usd) - MIN(fp.precio_usd)) / NULLIF(AVG(fp.precio_usd), 0),
        2
    ) AS indice_diversidad_gama
FROM dw.fact_productos fp
JOIN dw.dim_fuente df ON fp.id_fuente = df.id_fuente
WHERE fp.precio_usd IS NOT NULL
GROUP BY df.nombre_fuente
ORDER BY rango_total DESC;

-- KPI 5 — Preferencia de Plataformas (Encuesta)
CREATE OR REPLACE VIEW dw.v_kpi_preferencia_plataformas AS
SELECT
    df.nombre_fuente AS plataforma,
    COUNT(fec.id_hecho) AS votos,
    ROUND(COUNT(fec.id_hecho) * 100.0 / SUM(COUNT(fec.id_hecho)) OVER(), 1) AS pct_preferencia,
    ROUND(AVG(fec.edad), 1) AS edad_promedio_usuario,
    STRING_AGG(DISTINCT fec.frecuencia_compra, ', ') AS frecuencias_asociadas
FROM dw.fact_encuesta_consumo fec
JOIN dw.dim_fuente df ON fec.id_sitio_preferido = df.id_fuente
GROUP BY df.nombre_fuente
ORDER BY votos DESC;

-- ─── Step 4: materialized view + its unique index (E4 §5.6) ───────────────
-- KPI 6 — Vista materializada para el dashboard de precios por fuente y categoría.
-- The UNIQUE index is load-bearing: refreshMaterializedView() (analytics-query.service.ts)
-- calls REFRESH MATERIALIZED VIEW CONCURRENTLY, which requires it.
-- NOTE: PERCENTILE_CONT() always returns `double precision`, even when
-- ordering by a `numeric` column, so ROUND(..., 2) has no matching
-- overload without an explicit `::numeric` cast. The E4 doc's verbatim
-- SQL omits this cast (untested against a real empty schema); the
-- application-level queries already apply the same `::numeric` cast
-- (see analytics-query.service.ts, commit 92541d3) — applied here for
-- consistency and because `migrate deploy` fails without it.
CREATE MATERIALIZED VIEW dw.mv_resumen_precios AS
SELECT
    df.nombre_fuente,
    dc.nombre_categoria,
    COUNT(*) AS total,
    ROUND(AVG(fp.precio_usd), 2) AS precio_promedio,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fp.precio_usd)::numeric, 2) AS mediana,
    ROUND(STDDEV(fp.precio_usd), 2) AS desviacion,
    MIN(fp.precio_usd) AS minimo,
    MAX(fp.precio_usd) AS maximo
FROM dw.fact_productos fp
JOIN dw.dim_fuente df     ON fp.id_fuente = df.id_fuente
JOIN dw.dim_categoria dc  ON fp.id_categoria = dc.id_categoria
WHERE fp.precio_usd IS NOT NULL
GROUP BY df.nombre_fuente, dc.nombre_categoria
ORDER BY df.nombre_fuente, precio_promedio DESC;

CREATE UNIQUE INDEX idx_mv_resumen_precios
    ON dw.mv_resumen_precios (nombre_fuente, nombre_categoria);
