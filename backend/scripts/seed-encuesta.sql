-- Seed script para popular tabla fact_encuesta_consumo con datos de prueba
-- Ejecutar con: psql -U postgres -d analytics -f backend/scripts/seed-encuesta.sql

-- Verificar que las dimensiones existan
SELECT 'Géneros:' AS info;
SELECT id_genero, nombre_genero FROM dw.dim_genero;

SELECT 'Fuentes (Sitios):' AS info;
SELECT id_fuente, nombre_fuente FROM dw.dim_fuente;

-- Limpiar datos anteriores si es necesario (descomentar para limpiar)
-- TRUNCATE TABLE dw.fact_encuesta_consumo RESTART IDENTITY CASCADE;

-- Insertar 50 registros de prueba realistas
INSERT INTO dw.fact_encuesta_consumo (
  id_genero,
  id_sitio_preferido,
  edad,
  frecuencia_compra,
  gasto_promedio_mensual,
  motivo_compra
) VALUES
-- Mercado Libre - Masculino
(1, 1, 25, 'Semanal', '$100-$250', 'Electrónica'),
(1, 1, 32, 'Quincenal', '$50-$100', 'Ropa y accesorios'),
(1, 1, 45, 'Mensual', '$250-$500', 'Hogar y decoración'),
(1, 1, 28, 'Trimestral', '$100-$250', 'Electrónica'),
(1, 1, 35, 'Ocasional', '$50-$100', 'Deporte y fitness'),

-- Mercado Libre - Femenino
(2, 1, 29, 'Semanal', '$100-$250', 'Cosméticos y belleza'),
(2, 1, 38, 'Quincenal', '$50-$100', 'Ropa y accesorios'),
(2, 1, 26, 'Mensual', '$100-$250', 'Hogar y decoración'),
(2, 1, 42, 'Semanal', '$250-$500', 'Entretenimiento'),
(2, 1, 33, 'Trimestral', '$50-$100', 'Cosméticos y belleza'),

-- Mercado Libre - Otro
(3, 1, 24, 'Quincenal', '$10-$50', 'Entretenimiento'),
(3, 1, 31, 'Mensual', '$100-$250', 'Ropa y accesorios'),

-- AliExpress - Masculino
(1, 2, 27, 'Semanal', '$10-$50', 'Electrónica'),
(1, 2, 40, 'Ocasional', '$50-$100', 'Hogar y decoración'),
(1, 2, 22, 'Quincenal', '$10-$50', 'Entretenimiento'),
(1, 2, 37, 'Mensual', '$100-$250', 'Deporte y fitness'),
(1, 2, 29, 'Trimestral', '$50-$100', 'Electrónica'),

-- AliExpress - Femenino
(2, 2, 26, 'Semanal', '$50-$100', 'Ropa y accesorios'),
(2, 2, 44, 'Mensual', '$100-$250', 'Cosméticos y belleza'),
(2, 2, 23, 'Quincenal', '$10-$50', 'Ropa y accesorios'),
(2, 2, 35, 'Ocasional', '$50-$100', 'Hogar y decoración'),
(2, 2, 30, 'Semanal', '$100-$250', 'Entretenimiento'),

-- AliExpress - Otro
(3, 2, 28, 'Quincenal', '$50-$100', 'Electrónica'),

-- Temu - Masculino
(1, 3, 21, 'Semanal', '$10-$50', 'Entretenimiento'),
(1, 3, 36, 'Mensual', '$50-$100', 'Ropa y accesorios'),
(1, 3, 43, 'Ocasional', '$10-$50', 'Hogar y decoración'),
(1, 3, 25, 'Quincenal', '$50-$100', 'Electrónica'),

-- Temu - Femenino
(2, 3, 24, 'Semanal', '$50-$100', 'Ropa y accesorios'),
(2, 3, 39, 'Trimestral', '$100-$250', 'Cosméticos y belleza'),
(2, 3, 27, 'Mensual', '$10-$50', 'Entretenimiento'),
(2, 3, 33, 'Ocasional', '$50-$100', 'Ropa y accesorios'),
(2, 3, 41, 'Semanal', '$100-$250', 'Hogar y decoración'),

-- Shein - Masculino
(1, 4, 20, 'Semanal', '$10-$50', 'Ropa y accesorios'),
(1, 4, 34, 'Mensual', '$50-$100', 'Entretenimiento'),
(1, 4, 48, 'Ocasional', '$100-$250', 'Hogar y decoración'),

-- Shein - Femenino
(2, 4, 22, 'Semanal', '$50-$100', 'Ropa y accesorios'),
(2, 4, 37, 'Quincenal', '$100-$250', 'Cosméticos y belleza'),
(2, 4, 25, 'Trimestral', '$50-$100', 'Entretenimiento'),
(2, 4, 31, 'Mensual', '$100-$250', 'Ropa y accesorios'),
(2, 4, 46, 'Semanal', '$250-$500', 'Hogar y decoración'),
(2, 4, 28, 'Ocasional', '$50-$100', 'Cosméticos y belleza'),

-- Registros adicionales para completar 50
(1, 1, 50, 'Quincenal', '$250-$500', 'Electrónica'),
(2, 1, 23, 'Semanal', '$100-$250', 'Ropa y accesorios'),
(3, 2, 44, 'Mensual', '$100-$250', 'Hogar y decoración'),
(1, 3, 38, 'Quincenal', '$50-$100', 'Electrónica'),
(2, 4, 32, 'Trimestral', '$100-$250', 'Entretenimiento'),
(1, 4, 29, 'Semanal', '$10-$50', 'Ropa y accesorios'),
(2, 2, 51, 'Ocasional', '$500+', 'Cosméticos y belleza'),
(3, 1, 26, 'Semanal', '$100-$250', 'Deporte y fitness');

-- Verificar el resultado
SELECT '--- RESULTADO DE INSERCIÓN ---' AS info;
SELECT COUNT(*) as total_registros FROM dw.fact_encuesta_consumo;

-- Consulta de ejemplo: mismo formato que el endpoint
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
