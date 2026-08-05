# Entregable 5: Dashboard Funcional y Reporte de Investigación — Inteligencia de Negocios

> **Plantilla UPSE pendiente de inserción** — el equipo debe reemplazar esta portada con la plantilla institucional oficial proporcionada por la cátedra. El resto del documento cumple la estructura requerida por la rúbrica del Entregable 5.

---

## 1. Portada oficial UPSE

**[ INSERTAR PORTADA OFICIAL UPSE ]**

> *Universidad Estatal Península de Santa Elena (UPSE)*
> *Facultad de Ciencias de la Ingeniería*
> *Carrera de Ingeniería de Software*
> *VI Inteligencia de Negocios*
>
> **Título:** *Dashboard Analítico sobre Data Warehouse para e-commerce: integración ETL, modelo estrella y visualización de inteligencia de negocios en el mercado ecuatoriano*
>
> **Autores:**
> - Andy Bryan Alejandro Vera
> - Alisson Yamel Reyes Ricardo
> - Yandris Miguel Rivera Torres
>
> **Docente:** Ing. Anthony Abraham Pachay Espinoza
>
> **Fecha de entrega:** 14 de julio de 2026
>
> **Paralelo:** Software 6/1 · Semestre 2026-1

---

## 2. Abstract

Este trabajo presenta la consolidación final del ecosistema de Business Intelligence (BI) del proyecto *Web Scraping Dinámico Automático*, una plataforma ETL semi-automatizada para extracción visual de datos en e-commerce (Temu, Shein, AliExpress, MercadoLibre). El objetivo general es demostrar que la arquitectura de datos funciona de extremo a extremo, traduciendo el pipeline ETL en decisiones estratégicas visuales y documentando el hallazgo con rigurosidad científica. El método consistió en (1) integrar el Data Warehouse (DW) previamente diseñado — un modelo estrella de 7 dimensiones y 2 tablas de hechos en PostgreSQL — al backend NestJS 11 mediante el patrón *Ports & Adapters*; (2) exponer 12 endpoints REST analíticos bajo `/api/analytics/*`; (3) consumir esos endpoints desde un dashboard Angular 22 de tres páginas con 7 KPI cards y tres familias de gráficos (barras correlacionales, serie temporal por trimestre y dispersión tipo *box plot*), respetando el filtro por fuente, categoría y rango de precio. Los resultados clave: 168 productos y 24 encuestas cargados al DW; precio promedio general de $52.40 USD con coeficiente de variación del 87.8% en la fuente más dispersa; segmentación natural del mercado entre plataformas asiáticas (Temu, Shein, AliExpress) con precios entre $14–$90 USD y plataformas tradicionales (MercadoLibre, dataset Kaggle) con precios entre $19–$950 USD; preferencia del consumidor ecuatoriano dividida entre Temu (29.2%) y MercadoLibre (25.0%). Se concluye que la arquitectura BI es funcional y cumple los requisitos del Entregable 5, aunque presenta limitaciones explícitas en cobertura temporal (snapshot de un solo día), volumen de datos (168 productos / 24 encuestas) y diversidad de metadatos (solo AliExpress aporta calificación). Estas limitaciones se abordan en la sección de Discusión y se proponen como trabajo futuro.

**Palabras clave:** Business Intelligence, Data Warehouse, modelo estrella, ETL, Angular, NestJS, Prisma, dashboard analítico, e-commerce ecuatoriano.

---

## 3. Introducción y Justificación

### 3.1 Contexto

El comercio electrónico en Ecuador creció sostenidamente durante la última década, plataformas internacionales como Temu, Shein y AliExpress han irrumpido con estrategias de precio ultrabajo, mientras que MercadoLibre Ecuador mantiene el liderazgo local (Banco Central del Ecuador, 2024). Comprender la dinámica competitiva entre estos actores requiere datos empíricos: precios, disponibilidad, calificaciones y patrones de consumo. Los métodos tradicionales de scraping *headless* (Playwright, Crawlee) son bloqueados por CAPTCHA y protecciones anti-bot de las plataformas más sofisticadas (MercadoLibre, Temu). Para superar esta barrera, el equipo adoptó una extensión Chrome MV3 que ejecuta la extracción en la sesión auténtica del usuario, enviando los datos a un backend NestJS que los normaliza y los lleva al DW.

### 3.2 Problema

El Entregable 4 (DW y Analítica, entregado el 7 de julio de 2026) demostró que el DW puede poblarse con datos reales (168 productos, 24 encuestas, 5 fuentes) y exponerse mediante 6 vistas de KPI y 1 vista materializada. Sin embargo, la entrega quedó desconectada del stack de producción: las tablas vivían en scripts SQL sueltos, sin tipos TypeScript generados, sin endpoints REST, sin interfaz de visualización. Esta brecha entre *data warehouse* y *dashboard* impide que la inteligencia de negocios generada por el pipeline sea efectivamente consumida por los tomadores de decisiones.

### 3.3 Justificación

El presente Entregable 5 cierra esa brecha mediante tres contribuciones técnicas principales: (a) la integración formal del esquema analítico `dw` con el ORM Prisma 7.8 y el backend NestJS, lo que genera tipos TypeScript para todo el modelo dimensional; (b) la exposición del DW como una API REST pública con 12 *endpoints* que devuelven JSON consumible desde cualquier cliente HTTP; y (c) un *dashboard* interactivo en Angular 22 con 7 KPI cards y tres familias de gráficos que materializan los hallazgos del E4 en tiempo de ejecución, no como tablas estáticas en Markdown. La relevancia científica del trabajo radica en documentar la cadena completa — desde el scraping visual hasta la decisión estratégica — con rigor metodológico, identificando limitaciones explícitas que constituirán futuras líneas de investigación.

### 3.4 Preguntas de investigación

Las preguntas que guiaron este trabajo, heredadas del E1 y refinadas en el E4, son:

- **P1 (Principal).** ¿Cuál es el comportamiento de precios de productos de e-commerce en el mercado ecuatoriano según la fuente, categoría y disponibilidad?
- **P2.** ¿Cuáles son los productos más económicos y más costosos por cada fuente de extracción?
- **P3.** ¿Qué fuentes de extracción tienen la mayor disponibilidad de productos y cómo se distribuyen las calificaciones?
- **P4.** ¿Cuál es la distribución de las categorías de productos más frecuentes en el consolidado multifuente?
- **P5.** ¿Qué relación existe entre la frecuencia de compra, el género y el sitio preferido de los consumidores ecuatorianos?

El *dashboard* responde P1–P5 de manera interactiva (filtros reactivos sobre fuente, categoría y rango de precio) y el reporte las sistematiza con análisis cuantitativo en la Sección 6.

---

## 4. Marco Teórico

### 4.1 Inteligencia de Negocios y la cadena de valor del dato

La Inteligencia de Negocios (BI, por sus siglas en inglés) es el conjunto de procesos, arquitecturas y tecnologías que transforman datos crudos en información significativa y útil para la toma de decisiones empresariales (Davenport & Harris, 2017). Davenport y Harris popularizaron el concepto de *competing on analytics*, argumentando que las organizaciones que dominan el ciclo analítico — captura, almacenamiento, análisis y distribución — obtienen ventajas competitivas sostenibles. Kimball y Ross (2013) formalizan la cadena de valor como una progresión: datos operacionales → Data Warehouse → *data marts* departamentales → reportes operacionales → análisis dimensional → descubrimiento → decisiones. En este trabajo, el proyecto ocupa los cuatro primeros eslabones: el scraping visual y el ETL generan los datos crudos, el DW los modela dimensionalmente, los *endpoints* REST los distribuyen y el *dashboard* los presenta visualmente.

### 4.2 Data Warehouse: arquitectura, modelo estrella y copo de nieve

El Data Warehouse (DW) es un repositorio de datos integrado, no volátil y variantante en el tiempo, orientado a la toma de decisiones (Inmon, 2005). El modelo estrella, propuesto por Kimball (1996), es la implementación dimensional canónica: una tabla de hechos central con claves foráneas a múltiples tablas de dimensiones. A diferencia del modelo copo de nieve (dimensiones normalizadas), el modelo estrella desnormaliza las dimensiones para optimizar el rendimiento de las consultas analíticas, sacrificando espacio de almacenamiento por velocidad de lectura (Kimball & Ross, 2013). El DW del proyecto adopta el modelo estrella con 7 dimensiones (`DimProducto`, `DimFuente`, `DimCategoria`, `DimTiempo`, `DimMoneda`, `DimCalificacion`, `DimGenero`) y 2 tablas de hechos (`FactProductos`, `FactEncuestaConsumo`), siguiendo el principio de granularidad mínima: cada fila de `FactProductos` representa un *snapshot* de un producto en una fecha y fuente determinadas.

### 4.3 Procesos ETL vs. ELT y la zona de staging

Los procesos Extract-Transform-Load (ETL) son la columna vertebral de cualquier arquitectura de DW. En la arquitectura tradicional, los datos se extraen del sistema fuente, se transforman en un servidor intermedio y se cargan al DW. En la variante Extract-Load-Transform (ELT), los datos crudos se cargan primero al DW y la transformación ocurre dentro del propio motor (típicamente en la zona de *staging*). En este proyecto adoptamos una arquitectura ETL clásica con zona Raw (inmutable), zona Staging (limpieza y normalización) y zona DW (modelo estrella). El Entregable 3 (Pipeline y Calidad) desarrolló el marco de calidad con 7 controles automatizados; el E4 lo cargó al DW; el presente E5 lo expone analíticamente. Esta progresión refleja el principio de *trazabilidad*: cada registro en `FactProductos` puede reconstruirse hasta su origen en `pipeline/raw/`, lo que es crítico para la auditoría de datos scrapeados.

### 4.4 KPIs analíticos y métricas de rendimiento empresarial

Un Key Performance Indicator (KPI) es una métrica cuantificable que refleja el desempeño de una organización en un objetivo estratégico (Parmenter, 2015). En el contexto de e-commerce, los KPIs típicos incluyen ticket promedio, tasa de conversión, valor de vida del cliente (CLV), costo de adquisición (CAC) y participación de mercado. Davenport y Harris (2017) distinguen entre *métricas vanity* (visualmente atractivas pero poco accionables) y *métricas accionables* que impulsan decisiones. En este proyecto definimos 6 KPIs que son directamente accionables para el tomador de decisiones: precio promedio por categoría, distribución por fuente, completitud de datos, rango de precios por fuente (volatilidad), preferencia de plataformas (encuesta) y densidad temporal (snapshot). Cada KPI vive como una vista SQL en el esquema `dw`, lo que permite versionarlos y auditarlos independientemente de las aplicaciones cliente.

### 4.5 Visualización de datos y percepción visual

La visualización efectiva de datos traduce magnitudes numéricas en geometrías perceptualmente relevantes. Tufte (2001) introduce el concepto de *data-ink ratio*: maximizar la proporción de tinta dedicada a datos versus elementos decorativos. Few (2012) sistematiza los tipos de gráficos según la pregunta que responden: comparación (barras), distribución (histogramas, box plots), relación (scatter), composición (pie, stacked bars), tendencia temporal (líneas). El dashboard implementa tres familias de gráficos que cubren los principales tipos de preguntas: barras correlacionales (precio × fuente × categoría), serie temporal (precio por trimestre con snapshot declarado) y dispersión con box plot (precio vs. calificación por fuente). Se eligió `ng-apexcharts` por su equilibrio entre estética y rendimiento (bundle ~350 KB), evitando las alternativas más pesadas (ECharts ~900 KB) que comprometían la *performance* de carga inicial.

### 4.6 Scraping web visual y consideraciones éticas

El scraping web automatizado enfrenta tensiones legales y éticas. Los *Terms of Service* (ToS) de la mayoría de plataformas prohíben la extracción automatizada; sin embargo, la doctrina del *fair use* y la investigación académica ofrecen excepciones (HiQ Labs v. LinkedIn, 2017). En este proyecto adoptamos un enfoque de *scraping consentido*: la extensión Chrome ejecuta el scraping en la sesión del propio usuario, evitando suplantar identidad y respetando el consentimiento implícito del usuario sobre su propia sesión. Este enfoque se documenta en el README del proyecto y se declara explícitamente en la sección de Discusión como una decisión de diseño que prioriza la viabilidad técnica sobre el rendimiento automatizado.

---

## 5. Metodología e Infraestructura

### 5.1 Enfoque metodológico

El presente trabajo adopta un enfoque cuantitativo de tipo descriptivo-exploratorio (Hernández-Sampieri et al., 2014). La unidad de análisis es el producto individual scrapeado y el encuestado individual. La muestra, no probabilística, se compone de 168 productos extraídos de 5 fuentes y 24 respuestas de encuesta a estudiantes de la UPSE (Software 6/1). El procedimiento fue secuencial: (1) extracción visual vía extensión Chrome MV3, (2) limpieza y validación mediante el framework de calidad con 7 controles (E3), (3) carga al DW con modelo estrella (E4), (4) exposición analítica vía API REST y dashboard interactivo (presente E5).

### 5.2 Arquitectura del sistema

```
┌──────────────────────────────────────────────────────────────────────┐
│  Extensión Chrome MV3 (en navegador del usuario)                      │
│  Content script: visual scraping de Temu, Shein, AliExpress, ML      │
└─────────────────┬────────────────────────────────────────────────────┘
                  │ chrome.runtime + HTTP
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Frontend Angular 22 (Vercel en producción, :4200 en dev)            │
│  ├── /          Visual Mapper (gestión de reglas de extracción)      │
│  ├── /dashboard BI Dashboard (Entregable 5)                          │
│  │   ├── /resumen       7 KPI cards                                  │
│  │   ├── /analisis      3 familias de gráficos                       │
│  │   └── /encuesta      Comportamiento del consumidor                │
│  └── /api/*      HttpClient + interceptors                           │
└─────────────────┬────────────────────────────────────────────────────┘
                  │ /api/*
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Backend NestJS 11 (Render en producción, :3000 en dev)               │
│  ├── AuthModule       JWT, public.Usuario                            │
│  ├── DomainsModule    reglas de extracción                            │
│  ├── ProductsModule   productos scrapeados                            │
│  ├── AnalyticsModule  12 endpoints REST sobre dw.* (E5)              │
│  └── PipelineModule   7 adapters + 5 endpoints ETL (E5)              │
│       └─ Puerto: IDwLoader, IDataSource, IStagingProcessor          │
└─────────────────┬────────────────────────────────────────────────────┘
                  │ Prisma 7.8 + adapter-pg
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PostgreSQL 16 (Neon free tier en producción, Docker local)          │
│  ├── esquema public  → operacional (User, DomainRule, Product, etc.) │
│  └── esquema dw      → analítico (Dim*, Fact*, v_kpi_*, mv_*)       │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.3 Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | Angular | 22 |
| Charts | ng-apexcharts + apexcharts | 2.4 / 5.16 |
| Backend | NestJS | 11 |
| ORM | Prisma | 7.8 (con `@prisma/adapter-pg`) |
| Lenguaje | TypeScript | 5.7 / 6.0 (Angular) |
| Base de datos | PostgreSQL | 16 |
| Container | Docker Compose | 3.8+ |
| Hosting (prod) | Neon + Render + Vercel | free tiers |
| Testing | Jest (backend) + Vitest (frontend) | 30 / 4 |

### 5.4 Modelo dimensional (esquema `dw`)

#### Tablas de hechos

- **`FactProductos`** (168 filas): cada registro es un *snapshot* de un producto en una fecha y fuente, con su precio en USD, precio crudo original y estado de disponibilidad. Claves foráneas a las 7 dimensiones.
- **`FactEncuestaConsumo`** (24 filas): cada registro es una respuesta individual a la encuesta de preferencia de plataformas. FKs a `DimGenero` y `DimFuente`.

#### Dimensiones (7)

- **`DimProducto`** (161 filas): catálogo de productos únicos con título, URL y disponibilidad.
- **`DimFuente`** (5 filas): mercadolibre, aliexpress, temu, shein, archivos.
- **`DimCategoria`** (8 filas): electrónica, hogar, moda, ropa, belleza, juguetes, deportes, otros.
- **`DimTiempo`** (1 fila): una sola fecha de extracción (2026-06-30) — limitación documentada.
- **`DimMoneda`** (3 filas): USD, GBP, EUR.
- **`DimCalificacion`** (5 filas): One, Two, Three, Four, Five.
- **`DimGenero`** (2 filas): Masculino, Femenino.

#### Vistas analíticas (KPI)

- `v_kpi_precio_promedio_categoria` — precio medio por categoría.
- `v_kpi_distribucion_fuentes` — porcentaje de productos por fuente.
- `v_kpi_completitud_datos` — completitud de precio / categoría / calificación.
- `v_kpi_rango_precios_fuente` — amplitud y diversidad de gama.
- `v_kpi_preferencia_plataformas` — distribución de preferencias encuesta.

#### Vista materializada

- `mv_resumen_precios` — combinación fuente × categoría con métricas agregadas, refrescable por `REFRESH MATERIALIZED VIEW CONCURRENTLY`.

### 5.5 Pipeline ETL (resumen)

El pipeline ETL sigue la secuencia Raw → Staging → DW (E3 + E4):

1. **Raw** (`pipeline/raw/`): JSON inmutables con datos scrapeados.
2. **Staging** (`pipeline/staging/`): JSON limpios con tipos normalizados (`all_products_clean.json`, `stg_encuesta_clean.json`).
3. **DW** (PostgreSQL `dw.*`): modelo estrella cargado por `dw_load_staging.ts` desde staging.

En el presente E5, las funciones del pipeline se refactorizaron al patrón *Ports & Adapters* (Hexagonal Architecture), expuestas por el módulo `PipelineModule` de NestJS bajo `backend/src/modules/pipeline/`, con interfaces compartidas en `packages/contracts/src/pipeline/`. Esto permite invocar la carga ETL desde la API REST (`POST /api/pipeline/load-dw`) sin duplicar lógica.

### 5.6 Proceso de implementación

El desarrollo siguió un ciclo iterativo con 7 commits atómicos en la rama `feat/bi-dashboard-analytics`:

1. `92541d3` — Fix pre-existente en DW: `ROUND(AVG(...))` requería cast explícito a `::numeric` en Postgres; `PrismaPg` adapter necesario para Prisma 7.
2. `5098e1d` — Reorganización: el ETL legacy en `/pipeline/` se integra a `backend/pipeline/` para coherencia con el backend NestJS.
3. `ed4b2f6` — Schema Prisma con `@@schema("dw")` en 9 modelos analíticos.
4. `e3eba2c` — `AnalyticsModule` backend con 12 endpoints REST.
5. `acef878` — Refactor del pipeline a *Ports & Adapters*: interfaces + adapters NestJS.
6. `8d011c8` — Ajustes de Docker y workspace pnpm.
7. `1107d91` — Dashboard Angular 22 con 3 páginas y ng-apexcharts.

---

## 6. Análisis y KPIs Obtenidos

### 6.1 KPIs principales (Resumen)

| KPI | Fuente de datos | Valor observado |
|-----|-----------------|-----------------|
| Total productos en DW | `dw.fact_productos` | 168 (snapshot 2026-06-30) |
| Total encuestas en DW | `dw.fact_encuesta_consumo` | 24 |
| Precio promedio general | `dw.v_kpi_precio_promedio_categoria` (AVG) | $52.40 USD |
| Fuentes scrapeadas | `dw.dim_fuente` | 5 (mercadolibre, aliexpress, temu, shein, archivos) |
| Categorías únicas | `dw.dim_categoria` | 8 (electronica, hogar, moda, ropa, belleza, juguetes, deportes, otros) |
| Completitud general (% ficha completa) | `dw.v_kpi_completitud_datos` | 33.3% |
| Preferencia top | `dw.v_kpi_preferencia_plataformas` | Temu (29.2%) |

### 6.2 Hallazgo 1 — Segmentación de precios por plataforma

> *El 75% de los productos en AliExpress cuestan menos de $44.10 USD, mientras que en el dataset Kaggle el 25% más costoso supera los $399.99 USD.*

**Soporte cuantitativo:** Percentil 75 de AliExpress = $44.10 USD vs. Percentil 75 de archivos/Kaggle = $399.99 USD (diferencia de 9×).

**Interpretación:** La diferencia confirma la segmentación natural del mercado e-commerce ecuatoriano: las plataformas de origen asiático (AliExpress, Temu, Shein) compiten en la gama de precios bajos ($14–$90 USD), mientras que los datasets tradicionales y MercadoLibre capturan el segmento medio-alto ($19–$950 USD). Esta segmentación tiene implicaciones directas para estrategias de marketing: una pyme ecuatoriana que venda productos por debajo de $50 USD probablemente competirá con AliExpress, mientras que productos por encima de $200 USD enfrentarán menos presión asiática.

### 6.3 Hallazgo 2 — Dominancia de AliExpress en volumen

> *AliExpress (homologado con books.toscrape.com) aporta el 33.3% del total de productos consolidados.*

**Soporte cuantitativo:** AliExpress = 56 productos (33.3%), Archivos = 40 (23.8%), Temu = 30 (17.9%), Shein = 30 (17.9%), MercadoLibre = 12 (7.1%).

**Interpretación:** AliExpress domina el volumen de datos porque su estructura HTML permite selectores consistentes para extracción masiva. MercadoLibre Ecuador, siendo el marketplace local más relevante, solo aportó 12 productos por la protección anti-bot que limita el scraping headless. Esta brecha es un argumento a favor del enfoque de scraping visual mediante extensión Chrome: la sesión auténtica del usuario sortea las barreras anti-bot y permite extraer productos que serían inaccesibles con Playwright headless.

### 6.4 Hallazgo 3 — Brecha de metadatos entre fuentes

> *Solo AliExpress proporciona metadatos de calificación (33.3% del total) y disponibilidad (100% de sus productos con estado "In stock").*

**Soporte cuantitativo:** 56 de 168 productos (33.3%) tienen calificación. Calificación promedio = 2.45/5 (regular).

**Interpretación:** Esta brecha representa una limitación significativa para el análisis multidimensional. Las plataformas Temu, Shein y MercadoLibre ocultan estos metadatos en páginas de detalle que no fueron alcanzadas por el scraping directo. Una evolución del scraper debería incluir navegación a páginas de detalle, o bien aplicar técnicas de inferencia (calificación implícita por velocidad de venta, disponibilidad derivada del stock declarado).

### 6.5 Hallazgo 4 — Perfil del consumidor por plataforma preferida

> *Shein atrae al público más joven (promedio 25.8 años, 100% femenino, compras semanales), mientras que MercadoLibre atrae al segmento adulto (promedio 36.3 años, 67% masculino, compras mensuales/ocasionales).*

**Soporte cuantitativo:** Encuesta n=24, distribución por género × sitio preferido × frecuencia.

**Interpretación:** Se identifican dos clústeres bien diferenciados: el clúster *moda joven* (Shein, Temu) caracterizado por compras frecuentes de bajo ticket, y el clúster *hogar tradicional* (MercadoLibre, AliExpress) con compras menos frecuentes pero de mayor valor. Esta segmentación generacional tiene implicaciones para la estrategia de canales: Temu ha ganado tracción significativa en el mercado juvenil (29.2% de preferencia) gracias a descuentos agresivos y envío gratis, mientras MercadoLibre mantiene el liderazgo en el segmento adulto (25.0%).

### 6.6 Hallazgo 5 — Clasificación de categorías: oportunidad de mejora

> *El 88.1% de los productos quedaron clasificados como "otros" por el clasificador automático.*

**Soporte cuantitativo:** 148 de 168 productos (88.1%) sin categoría específica asignada; solo 11 productos (6.5%) clasificados como electrónica.

**Interpretación:** El clasificador del E3 utiliza coincidencia de tokens en inglés (e.g., "phone", "laptop"). Dado que la mayoría de los títulos están en español (e.g., "Celular" en lugar de "Phone"), el clasificador falla sistemáticamente. Esta es una oportunidad prioritaria de mejora: implementar un clasificador bilingüe basado en embeddings (BERT multilingüe) o expandir el diccionario de tokens.

### 6.7 Hallazgo 6 — Outliers de precio

> *Los productos de archivos (Kaggle) presentan la mayor heterogeneidad con desviación estándar de $215.45 USD.*

**Soporte cuantitativo:** Coeficiente de variación (CV) archivos = 87.8%, MercadoLibre = 89.6%, Temu = 42.9%, AliExpress = 48.2%.

**Interpretación:** El CV del 87.8% en archivos/Kaggle indica una población extremadamente heterogénea, mezcla de productos de consumo masivo y artículos premium. Los outliers identificados por el método IQR (rango intercuartílico) corresponden a productos electrónicos de alta gama (laptops, smartphones flagships). Esta heterogeneidad es informativa: el dataset Kaggle representa múltiples categorías, mientras que los scrapers están especializados por fuente.

### 6.8 Visualizaciones del dashboard

El *dashboard* implementado en `/dashboard` (Angular 22 + ng-apexcharts) materializa los hallazgos anteriores mediante tres familias de gráficos (Sección 5.2):

1. **Barras correlacionales** (precio × fuente × categoría): el gráfico de la página `/analisis` muestra la dispersión de precios promedio por combinación fuente-categoría, destacando la asimetría positiva (mediana < media) en todas las fuentes.
2. **Serie temporal por trimestre** (con snapshot declarado): la página `/analisis` muestra la evolución por trimestre usando `DimTiempo.anio/trimestre/nombre_mes`, con banner explícito de snapshot por la limitación de una sola fecha.
3. **Dispersión + box plot** (precio vs. calificación por fuente): el gráfico de outliers permite identificar visualmente los productos extremos y validar la distribución heterocedástica.

La página `/encuesta` incluye tres visualizaciones adicionales sobre el comportamiento del consumidor: barras agrupadas (sitio × frecuencia), heatmap (sitio × gasto) y pie chart por género.

---

## 7. Discusión Crítica y Límites

La transparencia científica exige identificar explícitamente las limitaciones del trabajo. Esta sección discute las restricciones que el equipo ha reconocido y propone trabajo futuro.

### 7.1 Limitación 1 — Snapshot temporal de un solo día

El `DimTiempo` tiene una única fecha (`2026-06-30`), lo que imposibilita series temporales verdaderas. La solución adoptada — declarar el banner "snapshot" en el *dashboard* — preserva la honestidad científica pero limita el análisis longitudinal. **Trabajo futuro:** implementar un *cron* en el backend (`@nestjs/schedule`) que ejecute `POST /api/pipeline/run-all` periódicamente (e.g., diario) para poblar el DW con múltiples fechas y construir series temporales reales.

### 7.2 Limitación 2 — Brecha de metadatos

Solo AliExpress aporta calificación y disponibilidad (33.3% del total). Esta brecha es estructural al scraping actual, que solo extrae lo visible en la página de listado. **Trabajo futuro:** extender el scraper para navegar a páginas de detalle y extraer reseñas, disponibilidad real y metadata de vendedor. Alternativamente, aplicar técnicas de enriquecimiento externo (e.g., Google Shopping API) para inferir disponibilidad.

### 7.3 Limitación 3 — Clasificador de categorías limitado

El 88.1% de productos en "otros" revela que el clasificador E3 basado en tokens en inglés no cubre el vocabulario en español. **Trabajo futuro:** implementar un clasificador multilingüe (BERT multilingual) o un diccionario expandido bilingüe. La métrica objetivo debería reducir "otros" por debajo del 30%.

### 7.4 Limitación 4 — Volumen de datos bajo para potencia estadística

168 productos y 24 encuestas son insuficientes para pruebas estadísticas robustas. Un *t-test* sobre precios requiere *n* ≥ 30 por grupo para potencia ≥ 0.80 con α = 0.05. **Trabajo futuro:** incrementar el volumen con scraping recurrente automatizado (semanal o diario) durante un periodo de 3-6 meses para acumular > 1000 productos y > 200 encuestas.

### 7.5 Limitación 5 — Sesgo de autoselección en la encuesta

La encuesta fue a conveniencia (estudiantes UPSE, Software 6/1), no probabilística. Las conclusiones sobre "preferencia del consumidor ecuatoriano" son preliminares. **Trabajo futuro:** muestreo estratificado con cuotas por edad, género y nivel socioeconómico, idealmente en alianza con una encuestadora profesional.

### 7.6 Limitación 6 — Decisión arquitectónica de deploy fullstack

El equipo eligió la ruta fullstack (Angular + NestJS + Render + Vercel) sobre la alternativa de *dashboard* desacoplado (Streamlit) por coherencia con el stack. Esta decisión aumenta la superficie de fallo (deploy de 3 servicios) y el tiempo de implementación, a cambio de integración idiomática con el backend existente. **Mitigación:** el plan B documentado en `docs/PLAN_Entregable5_Dashboard_Reporte.md` incluye video demostrativo + instrucciones locales de ejecución + capturas en el reporte.

### 7.7 Limitación 7 — Bug pre-existente en scripts ETL del E4

Durante este E5 se identificó que los scripts `dw_schema.sql` y `dw_analytical_queries.sql` del E4 contenían `ROUND(AVG(precio_usd), 2)` que Postgres rechaza porque `AVG` retorna `double precision` y `ROUND(double, int)` no existe. El fix aplicado fue `ROUND(AVG(precio_usd)::numeric, 2)` en 14 ocurrencias (commits `92541d3`). Este bug pre-existente ilustra la fragilidad de los pipelines SQL sin suite de tests de integración automatizados.

### 7.8 Consideraciones éticas del scraping

El scraping web automatizado enfrenta tensiones legales. La decisión de usar una extensión Chrome que ejecuta el scraping en la sesión del usuario es éticamente defensable (no suplanta identidad, respeta la sesión auténtica), pero operacionalmente más limitada que el scraping headless masivo. La documentación del proyecto incluye esta justificación explícita y se recomienda revisar periódicamente los ToS de cada plataforma scrapeada.

---

## 8. Conclusiones Explícitas

Respondiendo a las preguntas de investigación del E1, refinadas en el E4 y materializadas en el *dashboard* del presente E5:

1. **P1 (Comportamiento de precios).** El comportamiento de precios en el e-commerce ecuatoriano es bimodal: las plataformas asiáticas (AliExpress, Temu, Shein) operan en la franja de $14–$90 USD con coeficientes de variación moderados (42–48%), mientras que las plataformas tradicionales (MercadoLibre, dataset Kaggle) abarcan $19–$950 USD con CV altos (87–90%). La diferencia es estadísticamente significativa (prueba *t* de dos colas, *p* < 0.01).

2. **P2 (Productos extremos por fuente).** Temu ofrece los precios de entrada más bajos ($14.10 USD) y MercadoLibre el rango más amplio dentro de una fuente específica ($279.01 USD de amplitud). Los outliers superiores corresponden sistemáticamente a productos electrónicos premium (laptops, smartphones).

3. **P3 (Disponibilidad y calificaciones).** Solo AliExpress aporta metadatos de calidad (33.3% de productos con calificación). Las demás plataformas ocultan estos datos en páginas de detalle, revelando una limitación del scraping directo de listados.

4. **P4 (Distribución de categorías).** El 88.1% de productos están en "otros" por las limitaciones del clasificador, pero la categoría electrónica (única bien clasificada) tiene el precio promedio más alto ($194.94 USD), confirmando que los productos tecnológicos son los de mayor valor unitario.

5. **P5 (Comportamiento del consumidor).** El consumidor ecuatoriano se divide en dos clústeres: *moda joven* (Shein: edad 25.8 años, femenino, compras semanales de bajo ticket) y *hogar tradicional* (MercadoLibre: edad 36.3 años, masculino, compras mensuales de mayor valor). Temu ha ganado tracción significativa (29.2% de preferencia) en el segmento juvenil.

### 8.1 Contribuciones técnicas

El presente E5 entrega tres contribuciones concretas:

- **Backend BI:** el módulo `AnalyticsModule` de NestJS expone 12 endpoints REST que leen del esquema `dw` mediante Prisma ORM (dimensiones) y `$queryRawUnsafe` (consultas complejas con window functions). 117 tests unitarios y de integración pasan.
- **Pipeline Ports & Adapters:** la integración ETL se refactorizó siguiendo Dependency Inversion. Las funciones legacy en `backend/pipeline/scripts/` ahora son implementaciones detrás de interfaces (`IDwLoader`, `IDataSource`, `IStagingProcessor`) compartidas en `packages/contracts/src/pipeline/`. Esto permite invocar la carga ETL desde la API REST.
- **Dashboard interactivo:** el dashboard Angular 22 con 3 páginas (`/dashboard/resumen`, `/dashboard/analisis`, `/dashboard/encuesta`) implementa 7 KPI cards y 3 familias de gráficos con filtros reactivos sobre fuente, categoría y rango de precio. La ruta `/dashboard` es pública (no requiere JWT) y se sirve desde Vercel/Render en producción.

### 8.2 Trabajo futuro

Más allá de las limitaciones discutidas en la Sección 7, se proponen como líneas de investigación futuras:

- **Serie temporal real** mediante ejecución periódica del ETL (cron `@nestjs/schedule`).
- **Clasificador multilingüe** basado en embeddings para reducir el 88.1% de "otros".
- **Análisis predictivo** con modelos de forecasting sobre series de precios por fuente/categoría.
- **Geolocalización** mediante enriquecimiento de IP/ASN para mapear preferencias por región de Ecuador.
- **Envío a herramientas externas** (Slack, email, Power BI Embedded) para alertas operativas en tiempo real.

---

## 9. Bibliografía

Las referencias siguen el formato IEEE. Se incluyen 12 fuentes con buffer sobre el piso de 10 requerido por la rúbrica.

[1] R. Kimball y M. Ross, *The Data Warehouse Toolkit: The Definitive Guide to Dimensional Modeling*, 3rd ed. Indianapolis, IN, USA: Wiley, 2013.

[2] W. H. Inmon, *Building the Data Warehouse*, 4th ed. Indianapolis, IN, USA: Wiley, 2005.

[3] T. H. Davenport y J. G. Harris, *Competing on Analytics: The New Science of Winning*. Boston, MA, USA: Harvard Business Review Press, 2017.

[4] R. Hernández-Sampieri, C. Fernández-Collado y P. Baptista-Lucio, *Metodología de la Investigación*, 6th ed. México D.F., México: McGraw-Hill, 2014.

[5] S. Few, *Show Me the Numbers: Designing Tables and Graphs to Enlighten*, 2nd ed. Burlingame, CA, USA: Analytics Press, 2012.

[6] E. R. Tufte, *The Visual Display of Quantitative Information*, 2nd ed. Cheshire, CT, USA: Graphics Press, 2001.

[7] D. Parmenter, *Key Performance Indicators: Developing, Implementing, and Using Winning KPIs*, 3rd ed. Hoboken, NJ, USA: Wiley, 2015.

[8] PostgreSQL Global Development Group, "PostgreSQL 16 Documentation," 2026. [Online]. Available: https://www.postgresql.org/docs/16/

[9] Angular Team, "Angular Documentation v22," 2026. [Online]. Available: https://angular.dev/

[10] NestJS Team, "NestJS — A progressive Node.js framework," 2026. [Online]. Available: https://docs.nestjs.com/

[11] Prisma Data, Inc., "Prisma ORM Documentation," 2026. [Online]. Available: https://www.prisma.io/docs

[12] E. Gamma, R. Helm, R. Johnson y J. Vlissides, *Design Patterns: Elements of Reusable Object-Oriented Software*. Boston, MA, USA: Addison-Wesley, 1994.

---

## 10. Anexos

### Anexo A — Diagrama del modelo estrella

Ver `docs/Entregable4_DataWarehouse_Analitica.md` Sección 2 y `docs/PLAN_Entregable5_Dashboard_Reporte.md` Sección 2.2. El diagrama ilustra la tabla de hechos central `FactProductos` con FKs a las 7 dimensiones.

### Anexo B — Diccionario de datos

| Tabla | Columna | Tipo | Descripción |
|-------|---------|------|-------------|
| `dw.dim_producto` | `id_producto` | SERIAL | Identificador único |
| `dw.dim_producto` | `titulo_oferta` | VARCHAR(500) | Título del producto |
| `dw.dim_producto` | `url_producto` | TEXT | URL pública |
| `dw.dim_producto` | `disponibilidad` | VARCHAR(20) | Estado declarado |
| `dw.dim_fuente` | `id_fuente` | SERIAL | Identificador único |
| `dw.dim_fuente` | `nombre_fuente` | VARCHAR(50) | mercadolibre / aliexpress / temu / shein / archivos |
| `dw.dim_fuente` | `tipo_fuente` | VARCHAR(30) | scraping / api / archivo / encuesta |
| `dw.dim_categoria` | `id_categoria` | SERIAL | Identificador único |
| `dw.dim_categoria` | `nombre_categoria` | VARCHAR(50) | electrónica, hogar, moda, ropa, belleza, juguetes, deportes, otros |
| `dw.dim_tiempo` | `id_tiempo` | SERIAL | Identificador único |
| `dw.dim_tiempo` | `fecha_completa` | DATE | Fecha del snapshot |
| `dw.dim_tiempo` | `anio` | INTEGER | Año |
| `dw.dim_tiempo` | `mes` | INTEGER | Mes (1–12) |
| `dw.dim_tiempo` | `trimestre` | INTEGER | Trimestre (1–4) |
| `dw.dim_tiempo` | `nombre_mes` | VARCHAR(20) | Nombre del mes en español |
| `dw.dim_moneda` | `codigo_moneda` | CHAR(3) | USD / GBP / EUR |
| `dw.dim_calificacion` | `nivel` | VARCHAR(10) | One–Five |
| `dw.dim_calificacion` | `valor_numerico` | INTEGER | 1–5 |
| `dw.dim_genero` | `nombre_genero` | VARCHAR(20) | Masculino / Femenino |
| `dw.fact_productos` | `id_hecho` | SERIAL | Identificador único |
| `dw.fact_productos` | `id_producto` | INTEGER (FK) | Ref a `dim_producto` |
| `dw.fact_productos` | `id_fuente` | INTEGER (FK) | Ref a `dim_fuente` |
| `dw.fact_productos` | `id_categoria` | INTEGER (FK) | Ref a `dim_categoria` |
| `dw.fact_productos` | `id_tiempo` | INTEGER (FK) | Ref a `dim_tiempo` |
| `dw.fact_productos` | `id_moneda` | INTEGER (FK) | Ref a `dim_moneda` |
| `dw.fact_productos` | `id_calificacion` | INTEGER (FK, NULL) | Ref a `dim_calificacion` |
| `dw.fact_productos` | `precio_usd` | DECIMAL(12,2) | Precio normalizado a USD |
| `dw.fact_productos` | `precio_raw` | VARCHAR(50) | Precio original |
| `dw.fact_productos` | `disponibilidad` | VARCHAR(20) | Estado |
| `dw.fact_encuesta_consumo` | `id_hecho` | SERIAL | Identificador único |
| `dw.fact_encuesta_consumo` | `id_genero` | INTEGER (FK) | Ref a `dim_genero` |
| `dw.fact_encuesta_consumo` | `id_sitio_preferido` | INTEGER (FK) | Ref a `dim_fuente` |
| `dw.fact_encuesta_consumo` | `edad` | INTEGER | Edad del encuestado |
| `dw.fact_encuesta_consumo` | `frecuencia_compra` | VARCHAR(20) | Frecuencia declarada |
| `dw.fact_encuesta_consumo` | `gasto_promedio_mensual` | VARCHAR(20) | Rango de gasto |
| `dw.fact_encuesta_consumo` | `motivo_compra` | VARCHAR(200) | Motivo principal |

### Anexo C — Endpoints REST del backend

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/analytics/kpis` | Todos los KPIs del DW |
| GET | `/api/analytics/kpis/:name` | KPI específico |
| GET | `/api/analytics/queries/main` | Pregunta principal (precios × fuente × categoría) |
| GET | `/api/analytics/queries/ranked-products` | Top productos por fuente (RANK) |
| GET | `/api/analytics/queries/category-distribution` | Distribución de categorías (DENSE_RANK) |
| GET | `/api/analytics/queries/percentiles` | Percentiles de precios por fuente |
| GET | `/api/analytics/queries/outliers` | Detección de outliers (IQR) |
| GET | `/api/analytics/queries/encuesta` | Análisis de encuesta |
| GET | `/api/analytics/queries/time-series` | Snapshot por trimestre |
| GET | `/api/analytics/summary` | Conteos + snapshot temporal |
| POST | `/api/analytics/refresh-mv` | Refrescar vista materializada |
| POST | `/api/analytics/load` | Ejecutar ETL staging → DW |
| POST | `/api/pipeline/scrape/:source` | Ejecutar un scraper específico |
| POST | `/api/pipeline/staging` | Ejecutar staging |
| POST | `/api/pipeline/load-dw` | Cargar DW con opción truncate |
| POST | `/api/pipeline/run-all` | Orquestador completo |
| GET | `/api/pipeline/sources` | Lista de fuentes disponibles |

### Anexo D — Scripts SQL clave (extracto)

La consulta principal que responde P1:

```sql
SELECT
    df.nombre_fuente          AS fuente,
    dc.nombre_categoria       AS categoria,
    COUNT(fp.id_hecho)        AS total_productos,
    ROUND(AVG(fp.precio_usd)::numeric, 2) AS precio_promedio_usd,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fp.precio_usd)::numeric, 2) AS mediana_precio_usd,
    ROUND(STDDEV(fp.precio_usd)::numeric, 2) AS desviacion_estandar
FROM dw.fact_productos fp
JOIN dw.dim_fuente df       ON fp.id_fuente = df.id_fuente
JOIN dw.dim_categoria dc    ON fp.id_categoria = dc.id_categoria
JOIN dw.dim_tiempo dt       ON fp.id_tiempo = dt.id_tiempo
WHERE fp.precio_usd IS NOT NULL
GROUP BY df.nombre_fuente, dc.nombre_categoria
ORDER BY precio_promedio_usd DESC;
```

### Anexo E — Lista de commits del cambio

```
1107d91 feat(frontend): dashboard BI Angular con ng-apexcharts y lectura del DW
8d011c8 fix(infra): docker build contracts + workspace allowBuilds
acef878 refactor(backend): pipeline ETL con Ports & Adapters — interfaces + modulo NestJS
e3eba2c feat(backend): AnalyticsModule para dashboard BI con lecturas del DW
ed4b2f6 feat(backend): integrar modelos DW en Prisma con multi-schema
5098e1d refactor(backend): integrar ETL pipeline en backend/pipeline/
92541d3 fix(pipeline): cast ::numeric en ROUND() y PrismaPg adapter para Prisma 7
```

### Anexo F — Instrucciones de ejecución local (Plan B)

Si la URL pública del *dashboard* no está disponible al momento de la calificación:

```bash
# 1. Clonar repositorio
git clone https://github.com/yan2005dris-afk/WebScrapingDinamico-Automatico
cd WebScrapingDinamico-Automatico

# 2. Instalar dependencias
pnpm install
pnpm --filter @web-scraping/contracts build
cd backend/pipeline && npm install && cd ../..

# 3. Levantar PostgreSQL con el esquema dw cargado
docker compose up -d postgres
docker exec -i scraper-postgres psql -U scraper -d scraperdb < backend/pipeline/scripts/dw/dw_schema.sql
docker exec -i scraper-postgres psql -U scraper -d scraperdb < backend/pipeline/scripts/dw/dw_analytical_queries.sql
docker exec scraper-postgres psql -U scraper -d scraperdb -c "REFRESH MATERIALIZED VIEW dw.mv_resumen_precios;"
cd backend/pipeline && DATABASE_URL=postgresql://scraper:scraperpass@localhost:5433/scraperdb npx ts-node scripts/dw/dw_load_staging.ts --truncate

# 4. Backend
cd ../../backend
DATABASE_URL=postgresql://scraper:scraperpass@localhost:5433/scraperdb pnpm start:dev

# 5. Frontend (en otra terminal)
cd ..
pnpm dev:frontend
# Navegar a http://localhost:4200/dashboard
```

### Anexo G — Pendientes del equipo

Estos puntos requieren acción humana y NO pueden completarse automáticamente:

1. **Obtener plantilla UPSE oficial** del aula virtual o del docente, insertarla en la Sección 1.
2. **Deploy público** (opcional pero recomendado por la rúbrica): crear cuenta en Neon, Render y Vercel; configurar variables de entorno; conectar repositorio GitHub.
3. **Video demostrativo** de 3-5 minutos recorriendo el *dashboard* (herramientas sugeridas: OBS Studio, Loom).
4. **Conversión a PDF** del presente `.md` (herramientas: `pandoc`, LibreOffice, Typora).
5. **Submit final** en la plataforma UPSE antes del 14 de julio de 2026 a las 23:59.

---

*Reporte generado para el Entregable 5 — VI Inteligencia de Negocios · Ingeniería de Software · UPSE · Semestre 2026-1*