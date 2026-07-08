# Pipeline de Ingesta y Calidad de Datos (Entregable 3)

Este directorio contiene el pipeline de datos completo (ETL) desarrollado en TypeScript / Node.js para cumplir con las directivas del Entregable 3.

## 🚀 Inicio Rápido (Ejecución de Extremo a Extremo)

Para inicializar y ejecutar todo el pipeline de forma automática (los 4 scrapers de web, el consumo de API, el cargador de archivos estructurados, el anonimizador de encuestas, el procesamiento en staging y el framework con los 7 controles de calidad):

```bash
# 1. Navegar a la carpeta del pipeline
cd pipeline

# 2. Instalar las dependencias de Node
npm install

# 3. Correr el pipeline completo de extremo a extremo
npm run pipeline
```

Este comando unificado ejecutará las fases en la secuencia exacta y producirá los reportes y datos limpios listos para el Data Warehouse.

---

## 🛠️ Ejecución por Fases / Scripts Individuales

Si deseas ejecutar los scripts de forma independiente, puedes usar los siguientes comandos desde el directorio `pipeline/`:

### 1. Ingesta y Extracción a Raw (Inmutabilidad)
*   **Web Scraping (MercadoLibre)**:
    `npm run scrape:mercadolibre` (Extrae productos de tecnología de MercadoLibre Ecuador usando Playwright).
*   **Web Scraping (AliExpress)**:
    `npm run scrape:aliexpress` (Extrae libros de *books.toscrape.com* como homólogo sin bloqueos utilizando Playwright).
*   **Web Scraping (Temu)**:
    `npm run scrape:temu` (Procesa el export de la extensión Chrome del proyecto en `raw/scraping/temu/extension_export.json`).
*   **Web Scraping (Shein)**:
    `npm run scrape:shein` (Procesa el export de la extensión en `raw/scraping/shein/extension_export.json`).
*   **API de Tasas cambiarias**:
    `npm run fetch:api` (Consume ExchangeRate API para obtener tasas reales de cambio y las almacena en JSON).
*   **Archivo Estructurado**:
    `npm run load:csv` (Carga `raw/archivos/dataset_original.csv`, valida esquema y lo guarda en Raw).
*   **Fuente Propia**:
    `npm run load:encuesta` (Carga `raw/fuente_propia/encuesta_raw.csv`, aplica anonimización ética y lo guarda en Raw).

### 2. Capa de Transformación (Staging)
*   **Procesamiento**:
    `npm run staging` (Ejecuta `run_all.ts` para normalizar nombres, estandarizar fechas, convertir precios a USD usando las tasas cargadas de la API, clasificar categorías y deduplicar por clave compuesta).

### 3. Capa de Calidad de Datos (Core)
*   **Controles de calidad**:
    `npm run quality` (Ejecuta `quality_checks.ts` aplicando los 7 controles programáticos sobre los productos y la encuesta, genera los datos limpios de salida y exporta el reporte final).

---

## 📂 Directorio de Resultados y Evidencia

Una vez ejecutado el pipeline, se generan los siguientes entregables técnicos en la carpeta `staging/`:

1.  `staging/all_products.json`: Base de datos de productos consolidados de las 5 fuentes (4 scraping + 1 Kaggle CSV) homologados.
2.  `staging/stg_encuesta.json`: Base de datos de la encuesta propia, anonimizada y homologada.
3.  `staging/all_products_clean.json`: Datos de productos finales tras pasar por los controles de duplicados, nulos y castings numéricos del Framework de Calidad.
4.  `staging/stg_encuesta_clean.json`: Respuestas de encuestas listas para el Data Warehouse.
5.  `staging/quality_report.json`: Reporte estadístico consolidado con métricas de completitud, tasas de error y matrices de nulos por fuente.
6.  `logs/pipeline_errors.log`: Bitácora persistente y auditable de anomalías detectadas en el pipeline.
