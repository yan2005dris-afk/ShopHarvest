-- ============================================================
-- Consultas Analíticas y KPIs del Data Warehouse
-- Entregable 4: Data Warehouse y Analítica
-- Inteligencia de Negocios · UPSE · Julio 2026
-- ============================================================

-- ============================================================
-- SECCIÓN 1: CONSULTAS ANALÍTICAS (Preguntas de Investigación)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Pregunta Principal:
-- ¿Cuál es el comportamiento de precios de productos de
-- e-commerce según fuente, categoría y disponibilidad?
-- ─────────────────────────────────────────────────────────────
SELECT
    df.nombre_fuente          AS fuente,
    dc.nombre_categoria       AS categoria,
    COUNT(fp.id_hecho)        AS total_productos,
    ROUND(AVG(fp.precio_usd)::numeric, 2) AS precio_promedio_usd,
    ROUND(MIN(fp.precio_usd), 2)  AS precio_minimo_usd,
    ROUND(MAX(fp.precio_usd), 2)  AS precio_maximo_usd,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fp.precio_usd)::numeric, 2) AS mediana_precio_usd,
    ROUND(STDDEV(fp.precio_usd)::numeric, 2) AS desviacion_estandar
FROM dw.fact_productos fp
JOIN dw.dim_fuente df       ON fp.id_fuente = df.id_fuente
JOIN dw.dim_categoria dc    ON fp.id_categoria = dc.id_categoria
JOIN dw.dim_tiempo dt       ON fp.id_tiempo = dt.id_tiempo
WHERE fp.precio_usd IS NOT NULL
GROUP BY df.nombre_fuente, dc.nombre_categoria
ORDER BY precio_promedio_usd DESC;

-- ─────────────────────────────────────────────────────────────
-- Pregunta Secundaria 1:
-- ¿Cuáles son los productos más económicos y más costosos
-- por cada fuente de extracción? (usa RANK analítico)
-- ─────────────────────────────────────────────────────────────
WITH ranked_products AS (
    SELECT
        df.nombre_fuente AS fuente,
        dp.titulo_oferta AS producto,
        fp.precio_usd,
        RANK() OVER (
            PARTITION BY df.nombre_fuente
            ORDER BY fp.precio_usd ASC NULLS LAST
        ) AS rank_economico,
        RANK() OVER (
            PARTITION BY df.nombre_fuente
            ORDER BY fp.precio_usd DESC NULLS LAST
        ) AS rank_costoso
    FROM dw.fact_productos fp
    JOIN dw.dim_producto dp ON fp.id_producto = dp.id_producto
    JOIN dw.dim_fuente df   ON fp.id_fuente = df.id_fuente
    WHERE fp.precio_usd IS NOT NULL
)
SELECT fuente, producto, precio_usd, 'MÁS ECONÓMICO' AS tipo
FROM ranked_products
WHERE rank_economico = 1

UNION ALL

SELECT fuente, producto, precio_usd, 'MÁS COSTOSO' AS tipo
FROM ranked_products
WHERE rank_costoso = 1

ORDER BY fuente, tipo DESC;

-- ─────────────────────────────────────────────────────────────
-- Pregunta Secundaria 2:
-- ¿Qué fuentes tienen la mayor disponibilidad de productos
-- y cómo se distribuyen las calificaciones?
-- ─────────────────────────────────────────────────────────────
SELECT
    df.nombre_fuente AS fuente,
    COUNT(fp.id_hecho) AS total_productos,
    SUM(CASE WHEN fp.disponibilidad IS NOT NULL THEN 1 ELSE 0 END) AS con_disponibilidad,
    ROUND(
        SUM(CASE WHEN fp.disponibilidad IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(fp.id_hecho),
        1
    ) AS pct_disponibilidad,
    COUNT(fp.id_calificacion) AS con_calificacion,
    ROUND(AVG(dc.valor_numerico)::numeric, 2) AS calificacion_promedio
FROM dw.fact_productos fp
JOIN dw.dim_fuente df ON fp.id_fuente = df.id_fuente
LEFT JOIN dw.dim_calificacion dc ON fp.id_calificacion = dc.id_calificacion
GROUP BY df.nombre_fuente
ORDER BY total_productos DESC;

-- ─────────────────────────────────────────────────────────────
-- Pregunta Secundaria 3:
-- ¿Cuál es la distribución de las categorías de productos
-- más frecuentes? (usa DENSE_RANK)
-- ─────────────────────────────────────────────────────────────
SELECT
    dc.nombre_categoria       AS categoria,
    COUNT(fp.id_hecho)        AS total_productos,
    ROUND(COUNT(fp.id_hecho) * 100.0 / SUM(COUNT(fp.id_hecho)) OVER(), 1) AS pct_del_total,
    ROUND(AVG(fp.precio_usd)::numeric, 2) AS precio_promedio,
    DENSE_RANK() OVER (ORDER BY COUNT(fp.id_hecho) DESC) AS rank_frecuencia
FROM dw.fact_productos fp
JOIN dw.dim_categoria dc ON fp.id_categoria = dc.id_categoria
GROUP BY dc.nombre_categoria
ORDER BY total_productos DESC;

-- ─────────────────────────────────────────────────────────────
-- Pregunta Secundaria 4 (Encuesta):
-- ¿Qué relación existe entre frecuencia de compra, género
-- y sitio preferido del consumidor ecuatoriano?
-- ─────────────────────────────────────────────────────────────
SELECT
    dg.nombre_genero          AS genero,
    df.nombre_fuente          AS sitio_preferido,
    COUNT(fec.id_hecho)       AS total_encuestados,
    fec.frecuencia_compra     AS frecuencia,
    fec.gasto_promedio_mensual AS gasto_promedio
FROM dw.fact_encuesta_consumo fec
JOIN dw.dim_genero dg  ON fec.id_genero = dg.id_genero
JOIN dw.dim_fuente df  ON fec.id_sitio_preferido = df.id_fuente
GROUP BY dg.nombre_genero, df.nombre_fuente, fec.frecuencia_compra, fec.gasto_promedio_mensual
ORDER BY total_encuestados DESC;

-- ============================================================
-- SECCIÓN 2: CONSULTAS AVANZADAS (Plus de Calificación)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 2.1 Análisis de Percentiles de Precios por Fuente
-- ─────────────────────────────────────────────────────────────
SELECT
    df.nombre_fuente AS fuente,
    COUNT(fp.precio_usd) AS total_con_precio,
    ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY fp.precio_usd)::numeric, 2) AS percentil_25,
    ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY fp.precio_usd)::numeric, 2) AS mediana,
    ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY fp.precio_usd)::numeric, 2) AS percentil_75,
    ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY fp.precio_usd)::numeric, 2) AS percentil_90,
    ROUND(AVG(fp.precio_usd)::numeric, 2) AS media,
    ROUND(STDDEV(fp.precio_usd)::numeric, 2) AS desviacion
FROM dw.fact_productos fp
JOIN dw.dim_fuente df ON fp.id_fuente = df.id_fuente
WHERE fp.precio_usd IS NOT NULL
GROUP BY df.nombre_fuente
ORDER BY media DESC;

-- ─────────────────────────────────────────────────────────────
-- 2.2 Detección de Outliers (Valores Atípicos) usando IQR
-- ─────────────────────────────────────────────────────────────
WITH stats AS (
    SELECT
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY precio_usd) AS q1,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY precio_usd) AS q3
    FROM dw.fact_productos
    WHERE precio_usd IS NOT NULL
)
SELECT
    dp.titulo_oferta AS producto,
    df.nombre_fuente AS fuente,
    fp.precio_usd,
    CASE
        WHEN fp.precio_usd < (SELECT q1 - 1.5 * (q3 - q1) FROM stats)
            THEN 'OUTLIER INFERIOR'
        WHEN fp.precio_usd > (SELECT q3 + 1.5 * (q3 - q1) FROM stats)
            THEN 'OUTLIER SUPERIOR'
        ELSE 'NORMAL'
    END AS clasificacion
FROM dw.fact_productos fp
JOIN dw.dim_producto dp ON fp.id_producto = dp.id_producto
JOIN dw.dim_fuente df   ON fp.id_fuente = df.id_fuente
WHERE fp.precio_usd IS NOT NULL
ORDER BY fp.precio_usd DESC;

-- ============================================================
-- SECCIÓN 3: KPIs (Vistas Lógicas)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- KPI 1: Precio Promedio por Categoría
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW dw.v_kpi_precio_promedio_categoria AS
SELECT
    dc.nombre_categoria AS categoria,
    COUNT(fp.id_hecho)  AS total_productos,
    ROUND(AVG(fp.precio_usd)::numeric, 2) AS precio_promedio_usd,
    ROUND(MIN(fp.precio_usd), 2) AS precio_minimo,
    ROUND(MAX(fp.precio_usd), 2) AS precio_maximo,
    CONCAT('$', ROUND(AVG(fp.precio_usd)::numeric, 2)) AS display_kpi
FROM dw.fact_productos fp
JOIN dw.dim_categoria dc ON fp.id_categoria = dc.id_categoria
WHERE fp.precio_usd IS NOT NULL
GROUP BY dc.nombre_categoria
ORDER BY precio_promedio_usd DESC;

-- ─────────────────────────────────────────────────────────────
-- KPI 2: Distribución de Productos por Fuente
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- KPI 3: Tasa de Completitud de datos
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- KPI 4: Rango de Precios por Fuente (Volatilidad)
-- ─────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────
-- KPI 5: Preferencia de Plataformas (Encuesta)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW dw.v_kpi_preferencia_plataformas AS
SELECT
    df.nombre_fuente AS plataforma,
    COUNT(fec.id_hecho) AS votos,
    ROUND(COUNT(fec.id_hecho) * 100.0 / SUM(COUNT(fec.id_hecho)) OVER(), 1) AS pct_preferencia,
    ROUND(AVG(fec.edad)::numeric, 1) AS edad_promedio_usuario,
    STRING_AGG(DISTINCT fec.frecuencia_compra, ', ') AS frecuencias_asociadas
FROM dw.fact_encuesta_consumo fec
JOIN dw.dim_fuente df ON fec.id_sitio_preferido = df.id_fuente
GROUP BY df.nombre_fuente
ORDER BY votos DESC;

-- ============================================================
-- SECCIÓN 4: CONSULTAS DE VERIFICACIÓN
-- ============================================================

-- 4.1 Verificar tablas del DW
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'dw'
ORDER BY table_name;

-- 4.2 Verificar registros por tabla
SELECT 'dim_producto' AS tabla, COUNT(*) AS registros FROM dw.dim_producto
UNION ALL SELECT 'dim_fuente', COUNT(*) FROM dw.dim_fuente
UNION ALL SELECT 'dim_categoria', COUNT(*) FROM dw.dim_categoria
UNION ALL SELECT 'dim_tiempo', COUNT(*) FROM dw.dim_tiempo
UNION ALL SELECT 'dim_moneda', COUNT(*) FROM dw.dim_moneda
UNION ALL SELECT 'dim_calificacion', COUNT(*) FROM dw.dim_calificacion
UNION ALL SELECT 'fact_productos', COUNT(*) FROM dw.fact_productos
UNION ALL SELECT 'dim_genero', COUNT(*) FROM dw.dim_genero
UNION ALL SELECT 'fact_encuesta_consumo', COUNT(*) FROM dw.fact_encuesta_consumo;

-- 4.3 Verificar vista materializada
SELECT * FROM dw.mv_resumen_precios
ORDER BY nombre_fuente, precio_promedio DESC;

-- ============================================================
-- FIN DE CONSULTAS ANALÍTICAS Y KPIs
-- ============================================================
