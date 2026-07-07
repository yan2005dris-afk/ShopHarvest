-- ============================================================
-- DDL del Data Warehouse — Modelo Estrella
-- Entregable 4: Data Warehouse y Analítica
-- Motor: PostgreSQL 16
-- Inteligencia de Negocios · UPSE · Julio 2026
-- ============================================================

-- Crear esquema del Data Warehouse
CREATE SCHEMA IF NOT EXISTS dw;

-- ─────────────────────────────────────────────────────────────
-- DIMENSIONES
-- ─────────────────────────────────────────────────────────────

-- DimProducto: Catálogo único de productos extraídos
CREATE TABLE dw.dim_producto (
    id_producto   SERIAL PRIMARY KEY,
    titulo_oferta VARCHAR(500) NOT NULL,
    url_producto  TEXT,
    disponibilidad VARCHAR(20)
);

-- DimFuente: Origen de los datos (plataforma de e-commerce)
CREATE TABLE dw.dim_fuente (
    id_fuente    SERIAL PRIMARY KEY,
    nombre_fuente VARCHAR(50) NOT NULL UNIQUE,
    tipo_fuente   VARCHAR(30),    -- scraping, archivo, api, encuesta
    descripcion   VARCHAR(200)
);

-- DimCategoria: Clasificación de productos
CREATE TABLE dw.dim_categoria (
    id_categoria    SERIAL PRIMARY KEY,
    nombre_categoria VARCHAR(50) NOT NULL UNIQUE,
    descripcion      VARCHAR(200)
);

-- DimTiempo: Calendario analítico
CREATE TABLE dw.dim_tiempo (
    id_tiempo      SERIAL PRIMARY KEY,
    fecha_completa DATE NOT NULL UNIQUE,
    anio           INTEGER NOT NULL,
    mes            INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    dia            INTEGER NOT NULL CHECK (dia BETWEEN 1 AND 31),
    trimestre      INTEGER NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
    nombre_mes     VARCHAR(20) NOT NULL
);

-- DimMoneda: Tipos de moneda
CREATE TABLE dw.dim_moneda (
    id_moneda    SERIAL PRIMARY KEY,
    codigo_moneda CHAR(3) NOT NULL UNIQUE,
    nombre_moneda VARCHAR(50),
    simbolo       VARCHAR(5)
);

-- DimCalificacion: Escala de calificación (One–Five)
CREATE TABLE dw.dim_calificacion (
    id_calificacion SERIAL PRIMARY KEY,
    nivel           VARCHAR(10) NOT NULL UNIQUE,
    valor_numerico  INTEGER NOT NULL CHECK (valor_numerico BETWEEN 1 AND 5)
);

-- DimGenero: Género de encuestados
CREATE TABLE dw.dim_genero (
    id_genero    SERIAL PRIMARY KEY,
    nombre_genero VARCHAR(20) NOT NULL UNIQUE,
    abreviatura   CHAR(1)
);

-- ─────────────────────────────────────────────────────────────
-- TABLAS DE HECHOS
-- ─────────────────────────────────────────────────────────────

-- FactProductos: Hechos de productos extraídos (tabla principal)
CREATE TABLE dw.fact_productos (
    id_hecho       SERIAL PRIMARY KEY,
    id_producto    INTEGER NOT NULL REFERENCES dw.dim_producto(id_producto),
    id_fuente      INTEGER NOT NULL REFERENCES dw.dim_fuente(id_fuente),
    id_categoria   INTEGER NOT NULL REFERENCES dw.dim_categoria(id_categoria),
    id_tiempo      INTEGER NOT NULL REFERENCES dw.dim_tiempo(id_tiempo),
    id_moneda      INTEGER NOT NULL REFERENCES dw.dim_moneda(id_moneda),
    id_calificacion INTEGER REFERENCES dw.dim_calificacion(id_calificacion),
    precio_usd     DECIMAL(12,2),
    precio_raw     VARCHAR(50),
    disponibilidad VARCHAR(20)
);

-- FactEncuestaConsumo: Hechos de encuesta a consumidores
CREATE TABLE dw.fact_encuesta_consumo (
    id_hecho              SERIAL PRIMARY KEY,
    id_genero             INTEGER NOT NULL REFERENCES dw.dim_genero(id_genero),
    id_sitio_preferido    INTEGER NOT NULL REFERENCES dw.dim_fuente(id_fuente),
    edad                  INTEGER,
    frecuencia_compra     VARCHAR(20),
    gasto_promedio_mensual VARCHAR(20),
    motivo_compra         VARCHAR(200)
);

-- ─────────────────────────────────────────────────────────────
-- ÍNDICES ANALÍTICOS
-- ─────────────────────────────────────────────────────────────

CREATE INDEX idx_fact_productos_fuente    ON dw.fact_productos(id_fuente);
CREATE INDEX idx_fact_productos_categoria ON dw.fact_productos(id_categoria);
CREATE INDEX idx_fact_productos_tiempo    ON dw.fact_productos(id_tiempo);
CREATE INDEX idx_fact_productos_precio    ON dw.fact_productos(precio_usd);
CREATE INDEX idx_fact_encuesta_genero     ON dw.fact_encuesta_consumo(id_genero);
CREATE INDEX idx_fact_encuesta_sitio      ON dw.fact_encuesta_consumo(id_sitio_preferido);

-- ─────────────────────────────────────────────────────────────
-- VISTAS MATERIALIZADAS (para rendimiento analítico)
-- ─────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW dw.mv_resumen_precios AS
SELECT
    df.nombre_fuente,
    dc.nombre_categoria,
    COUNT(*) AS total,
    ROUND(AVG(fp.precio_usd), 2) AS precio_promedio,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fp.precio_usd), 2) AS mediana,
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

COMMENT ON MATERIALIZED VIEW dw.mv_resumen_precios IS
'Vista materializada para dashboard de precios por fuente y categoría';

-- ============================================================
-- FIN DEL DDL
-- ============================================================
