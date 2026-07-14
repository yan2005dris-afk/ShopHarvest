# Plataforma ETL de Inteligencia de Negocios para E-commerce: Extracción Semi-Automatizada, Data Warehouse Relacional y Dashboard Analítico Interactivo

> **Reporte de Investigación · Entregable 5 (15%)**
> **Carrera:** Ingeniería de Software · VI Semestre
> **Materia:** Inteligencia de Negocios
> **Institución:** Universidad Estatal Península de Santa Elena (UPSE)
> **Periodo académico:** 2026-1
> **Plazo de entrega:** 14 de julio de 2026
> **Plataforma desplegada:** https://[DOMAIN] (URL pública provista al docente)
> **Código fuente:** https://github.com/yan2005dris-afk/WebScrapingDinamico-Automatico

---

## Resumen (Abstract)

El presente trabajo describe el diseño, implementación y despliegue de una plataforma de Inteligencia de Negocios de extremo a extremo, orientada a la captura y análisis competitivo de precios en sitios de e-commerce (Mercado Libre, AliExpress, Shein, Temu). La arquitectura se compone de cuatro capas desacopladas: (i) una extensión de navegador Chrome MV3 que ejecuta el raspado de datos en la sesión autenticada del usuario, sorteando así las protecciones anti-bot tipo Cloudflare y CAPTCHA; (ii) un backend NestJS que recibe, normaliza y persiste las capturas en una base de datos operacional transaccional (PostgreSQL); (iii) un proceso ETL programado que transforma dichas capturas en un Data Warehouse dimensional con esquema estrella; y (iv) un dashboard analítico interactivo construido en Angular 22, con once indicadores clave de rendimiento y cinco familias de gráficos alimentados en tiempo de ejecución desde el almacén de datos. La metodología combina principios de Kimball para el modelado dimensional con técnicas de extracción visual asistida por humanos en el bucle. Los resultados preliminares sobre 431 productos de cuatro fuentes ecuatorianas demuestran la viabilidad técnica del enfoque y exponen, al mismo tiempo, los límites del pipeline: dependencia de la estabilidad estructural de los selectores HTML, sesgo de cobertura geográfica y sensibilidad a la calidad de las dimensiones de tiempo. El documento discute estas restricciones y propone líneas de mejora para trabajos futuros.

**Palabras clave:** Web scraping, ETL, Data Warehouse, Inteligencia de Negocios, extensión de navegador, e-commerce, dashboard analítico, esquema estrella.

---

## 1. Introducción y Justificación

### 1.1 Contexto

El comercio electrónico en América Latina creció a una tasa anual compuesta del 25 % entre 2020 y 2025, según datos de la Cámara Ecuatoriana de Comercio Electrónico. Este crecimiento ha generado una demanda creciente de herramientas de *inteligencia de precios* que permitan a vendedores, compradores y analistas comprender la dinámica competitiva del mercado en tiempo casi real.

Sin embargo, la extracción automatizada de datos en sitios de comercio electrónico modernos enfrenta barreras técnicas considerables: protección Cloudflare, desafíos CAPTCHA, *fingerprinting* del navegador y bloqueos por IP. Las soluciones tradicionales basadas en *crawlers* headless (Puppeteer, Playwright, Crawlee) son detectadas y bloqueadas en cuestión de horas, lo que obliga a invertir en costosas granjas de proxies residenciales o servicios de resolución de CAPTCHA.

### 1.2 Problema

Diseñar e implementar una plataforma de Inteligencia de Negocios que:

1. Extraiga datos de productos en sitios de e-commerce sortenado las protecciones anti-bot contemporáneas.
2. Modele los datos extraídos en un esquema dimensional que habilite análisis OLAP eficientes.
3. Provea un dashboard interactivo con KPIs y visualizaciones que traduzcan los datos crudos en información accionable.
4. Sea desplegable en infraestructura de bajo costo y mantenible por equipos pequeños.

### 1.3 Justificación

La solución propuesta —una extensión de navegador que ejecuta el raspado en la sesión legítima del usuario— es **innovadora en el contexto regional**. Elimina por completo la necesidad de proxies residenciales y sortea las defensas anti-bot al ejecutar JavaScript en un contexto indistinguible del tráfico orgánico. Adicionalmente, el proyecto integra prácticas de ingeniería de software contemporáneas: arquitectura hexagonal, contratos compartidos, infraestructura como código y despliegue continuo.

### 1.4 Objetivos

**Objetivo general**

Construir una plataforma de BI que extraiga, transforme y visualice datos de precios de e-commerce, desde la captura en navegador hasta el dashboard analítico, en un único ecosistema coherente.

**Objetivos específicos**

1. Implementar una extensión Chrome MV3 con un *visual mapper* que permita a usuarios no técnicos definir selectores de extracción haciendo clic en los elementos de la página.
2. Diseñar e implementar un modelo dimensional en esquema estrella (Kimball) sobre PostgreSQL, con dimensiones conformes para fuente, categoría, tiempo, moneda y demografía.
3. Construir un proceso ETL idempotente que transforme capturas crudas en hechos y dimensiones, con manejo explícito de errores y bitácora de calidad.
4. Desarrollar un dashboard analítico interactivo con mínimo once KPIs y cinco familias de gráficos.
5. Desplegar la plataforma completa en infraestructura de producción con HTTPS y dominio público.

---

## 2. Marco Teórico

### 2.1 Extracción de datos en la web (Web Scraping)

El *web scraping* es el proceso automatizado de extracción de información estructurada desde páginas web. Se distingue del *web crawling*, que se enfoca en descubrir URLs [1]. Las técnicas contemporáneas se clasifican en tres categorías:

- **Crawling tradicional basado en HTTP:** Descarga el HTML estático y lo parsea. Limitado a páginas sin renderizado JavaScript.
- **Navegadores headless:** Puppeteer, Playwright, Selenium. Ejecutan JavaScript en un Chromium sin interfaz gráfica. Vulnerables a detección por *fingerprinting*.
- **Asistido por humanos en el bucle (Human-in-the-loop):** Delega la navegación real al usuario y solo automatiza la extracción dentro del DOM. Es la estrategia adoptada en este proyecto.

Las defensas anti-bot contemporáneas (Cloudflare Bot Management, PerimeterX, DataDome) combinan *fingerprinting* del navegador, análisis de comportamiento y *challenges* JavaScript [2]. Estudios recientes muestran tasas de detección superiores al 95 % para crawlers headless en sitios protegidos [3].

### 2.2 Arquitectura de Extensiones Chrome MV3

Chrome Manifest V3 (MV3) es la versión actual del modelo de extensiones del navegador Chrome, publicada en 2024 como sucesora de MV2. MV3 reemplaza el *background page* persistente por *service workers* event-driven y restringe el uso de `eval()` por seguridad [4]. El modelo de permisos declarativos (`host_permissions`, `permissions`) requiere que el usuario conceda explícitamente el acceso a cada dominio.

La extensión desarrollada aprovecha `chrome.scripting.executeScript()` para inyectar un script de extracción en el contexto de la página, accediendo directamente al DOM sin restricciones de CORS, dado que el código corre con los privilegios del usuario.

### 2.3 Modelado Dimensional y el Esquema Estrella

Ralph Kimball popularizó el *modelado dimensional* como técnica de diseño de almacenes de datos optimizados para consultas OLAP [5]. El *esquema estrella* se compone de:

- **Tabla de hechos:** Contiene las métricas medibles (precio, ventas, cantidad) y claves foráneas a las dimensiones.
- **Dimensiones:** Tablas descriptivas con atributos que permiten segmentar los hechos (fuente, categoría, tiempo, geografía).

El esquema estrella minimiza la cantidad de *joins* requeridos en consultas analíticas, a diferencia del esquema copo de nieve que normaliza las dimensiones. Para el proyecto se adoptó un esquema estrella clásico, con `fact_productos` como tabla de hechos principal y seis dimensiones conformes.

### 2.4 Procesos ETL y ELT

*Extract, Transform, Load* (ETL) es el patrón clásico de alimentación de almacenes de datos, donde la transformación ocurre antes de la carga [6]. *Extract, Load, Transform* (ELT) invierte el orden, aprovechando la potencia de los data warehouses columnares modernos. Para este proyecto se eligió ETL clásico por:

- Bajo volumen de datos (cientos a miles de filas por ejecución).
- Necesidad de validar y limpiar campos antes de la inserción.
- Disponibilidad de lógica de transformación compleja en TypeScript dentro del backend NestJS.

### 2.5 Inteligencia de Negocios y Visualización de Datos

La Inteligencia de Negocios (BI) es el conjunto de procesos, arquitecturas y tecnologías que transforman datos crudos en información significativa y útil para la toma de decisiones empresariales [7]. Los *dashboards* son la cara visible de los sistemas BI: vistas consolidadas de KPIs organizadas en un layout espacial [8].

La elección de *ApexCharts* como librería de visualización se justifica por:

- Compatibilidad nativa con Angular vía el envoltorio `ng-apexcharts`.
- Soporte para las cinco familias requeridas (barras, líneas, dispersión, *boxplot*, *heatmap*).
- Theming dinámico mediante tokens CSS.

---

## 3. Metodología e Infraestructura

### 3.1 Tipo de Investigación

Investigación aplicada, de carácter tecnológico-experimental, con enfoque cuantitativo. Se construye un artefacto de software (la plataforma) y se valida empíricamente su comportamiento sobre un conjunto de datos real.

### 3.2 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                  Chrome (sesión real del usuario)                │
│  ┌──────────────┐    ┌────────────────┐                          │
│  │ Visual Mapper│───▶│ Mapper engine  │──┐                       │
│  │ (UI overlay) │    │ (extractor)    │  │                       │
│  └──────────────┘    └────────────────┘  │                       │
│                                          ▼                       │
│                          ┌─────────────────────────┐             │
│                          │ chrome.runtime.message  │             │
│                          └────────────┬────────────┘             │
└────────────────────────────────────────┼────────────────────────┘
                                         │
                          ┌──────────────▼──────────────┐
                          │   Angular 22 (SPA)          │
                          │   - Visual Mapper UI        │
                          │   - Dashboard analítico     │
                          └──────────────┬──────────────┘
                                         │ HTTPS / REST
                          ┌──────────────▼──────────────┐
                          │   NestJS 11 (API)           │
                          │   /api/products/ingest      │
                          │   /api/analytics/kpis       │
                          │   /api/analytics/summary    │
                          │   /api/analytics/queries/*  │
                          │                             │
                          │   ┌──────────────────────┐  │
                          │   │ ETL Pipeline         │  │
                          │   │ raw → staging → dw    │  │
                          │   └──────────────────────┘  │
                          └─────┬───────────────┬───────┘
                                │               │
                  ┌─────────────▼───┐   ┌───────▼────────────┐
                  │  scraperdb      │   │  scraperdw         │
                  │  (operacional)  │   │  (data warehouse)  │
                  │  Postgres 16    │   │  Postgres 16       │
                  └─────────────────┘   └────────────────────┘
```

### 3.3 Stack Tecnológico

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| Extensión navegador | Chrome MV3 + TypeScript + Vite | MV3 / TS 5.4 | Ejecución en sesión real del usuario |
| Frontend | Angular | 22 | Componentes standalone, signals, OnPush |
| Visualización | ApexCharts + ng-apexcharts | 5.x / 2.x | 5 familias de gráficos, theming dinámico |
| Backend | NestJS + Prisma | 11 / 5.x | Inyección de dependencias, contratos tipados |
| Base operacional | PostgreSQL | 16 | Transaccional ACID |
| Data warehouse | PostgreSQL | 16 | Esquema estrella, queries OLAP |
| Reverse proxy | nginx | 1.27 | TLS termination, rate limiting |
| Certificados TLS | Let's Encrypt + certbot | — | HTTPS sin costo |
| Orquestación | Docker Compose | v2 | Infraestructura como código |
| CI/CD | GitHub Actions | — | Auto-deploy al VPS en push a `main` |

### 3.4 Modelo Dimensional

#### Diagrama del esquema estrella

```
                         ┌──────────────────┐
                         │  dim_calificacion│
                         │  PK: id_cal      │
                         │  rango_calif     │
                         └────────┬─────────┘
                                  │
┌──────────────┐    ┌─────────────▼─────────────┐    ┌──────────────┐
│  dim_fuente  │    │      fact_productos       │    │  dim_genero  │
│  PK: id_fnt  │◄───┤  PK: id_fact_producto    ├───►│  PK: id_gen  │
│  nombre_fnt  │    │  FK: id_fuente           │    │  nombre_gen  │
│  dominio_url │    │  FK: id_categoria        │    └──────────────┘
└──────────────┘    │  FK: id_tiempo           │
                    │  FK: id_moneda           │    ┌──────────────┐
                    │  FK: id_calificacion     │    │ dim_moneda   │
                    │  FK: id_producto (degen) │    │ PK: id_mon   │
                    │  precio_usd              │◄───┤ codigo_iso   │
                    │  disponibilidad          │    │ simbolo      │
                    │  score_outlier           │    └──────────────┘
                    └────────────┬─────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
       ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
       │ dim_producto │  │ dim_categoria│  │  dim_tiempo  │
       │ PK: id_prod  │  │ PK: id_cat   │  │ PK: id_tiempo│
       │ titulo       │  │ nombre_cat   │  │ fecha_comp   │
       │ url          │  │ categoria_padre│ │ anio        │
       │ sku          │  └──────────────┘  │ trimestre   │
       └──────────────┘                    │ mes         │
                                           └──────────────┘
```

#### Definición de métricas

- **precio_usd**: Precio del producto normalizado a dólares estadounidenses. El ETL realiza conversión desde la moneda local usando el tipo de cambio del día (snapshot).
- **disponibilidad**: Flag booleano que indica si el producto estaba disponible al momento de la captura.
- **score_outlier**: Clasificación IQR (`OUTLIER INFERIOR | OUTLIER SUPERIOR | NORMAL`) calculada por la consulta analítica del dashboard.

### 3.5 Pipeline ETL

El proceso ETL sigue el patrón *staging area*:

1. **Extracción** (`raw_captures`): La extensión envía el payload completo al endpoint `/api/products/ingest`. El backend valida con `class-validator` y persiste el JSON crudo en `raw_captures`.
2. **Staging** (`stg_productos`): Un trabajo programado transforma el JSON en filas planas, normalizando tipos y aplicando reglas de limpieza (trim, lowercase en strings, parseo numérico seguro).
3. **Carga dimensional** (`dw.*`): Las filas limpias se cargan en las tablas dimensionales mediante *upserts* (basados en claves naturales) y luego se insertan los hechos con `INSERT ... ON CONFLICT DO NOTHING`.

### 3.6 Estrategia de Despliegue

La plataforma se despliega en un VPS Ubuntu con Docker Compose. El stack de producción incluye cinco servicios:

1. **proxy** (nginx 1.27): Terminación TLS, reverse proxy público, rate limiting.
2. **certbot**: Emisión y renovación automática de certificados Let's Encrypt.
3. **frontend** (nginx + Angular estático): Sirve el SPA y sus assets.
4. **backend** (NestJS): API REST, planificación ETL, conexión a ambas bases.
5. **postgres** + **postgres-dw**: Dos instancias PostgreSQL aisladas (operacional transaccional y DW analítico).

El puerto 80/443 está expuesto únicamente por el proxy. Las bases de datos y el backend son inaccesibles desde internet; solo se comunican a través de la red interna de Docker (`scraper-network`).

El flujo de despliegue continuo: cada *push* a la rama `main` activa un workflow de GitHub Actions que se conecta al VPS por SSH, ejecuta `git pull` y recrea los contenedores modificados sin tiempo de inactividad para los demás.

---

## 4. Análisis y KPIs Obtenidos

### 4.1 Indicadores Clave de Rendimiento

Los once KPIs implementados se agrupan en tres familias:

#### Familia 1 · Resumen ejecutivo (7 KPIs)

| # | KPI | Definición | Fuente |
|---|-----|-----------|--------|
| 1 | **Productos capturados** | `COUNT(*) FROM dw.fact_productos` | DW |
| 2 | **Fuentes activas** | `COUNT(DISTINCT id_fuente) FROM dw.fact_productos WHERE disponibilidad` | DW |
| 3 | **Precio promedio (USD)** | `AVG(precio_usd) FROM dw.fact_productos` | DW |
| 4 | **Precio mediano (USD)** | `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY precio_usd)` | DW |
| 5 | **Desviación estándar** | `STDDEV(precio_usd) FROM dw.fact_productos` | DW |
| 6 | **% productos disponibles** | `100 * SUM(disponibilidad::int) / COUNT(*)` | DW |
| 7 | **% productos con calificación** | `100 * COUNT(id_calificacion) / COUNT(*)` | DW |

#### Familia 2 · Análisis de outliers (1 KPI)

| # | KPI | Definición | Fuente |
|---|-----|-----------|--------|
| 8 | **% de outliers (IQR)** | `100 * COUNT(WHERE clasificacion LIKE 'OUTLIER%') / COUNT(*)` | DW analítica |

#### Familia 3 · Encuesta de consumo (4 KPIs)

| # | KPI | Definición | Fuente |
|---|-----|-----------|--------|
| 9 | **Encuestados totales** | `COUNT(*) FROM dw.fact_encuesta_consumo` | DW |
| 10 | **Sitio preferido principal** | Modo de `sitio_preferido` | DW |
| 11 | **Gasto mensual promedio (USD)** | `AVG(gasto_promedio)` recodificado | DW |

### 4.2 Familias de Gráficos

| # | Familia | Tipo | Dimensiones |
|---|---------|------|-------------|
| 1 | **Barras correlacionales** | Grouped bar | Fuente × Categoría (eje X: categorías, series: fuentes, valor: precio promedio USD) |
| 2 | **Serie temporal** | Line chart multi-series | Tiempo × Fuente (eje X: trimestre, series: fuentes, valor: precio promedio) |
| 3 | **Dispersión de outliers** | Scatter con clasificación | Producto × Precio (color: OUTLIER INFERIOR / SUPERIOR / NORMAL) |
| 4 | **Box plot por fuente** | Box plot estadístico | Fuente × Distribución de precios (cinco números: min, Q1, mediana, Q3, max) |
| 5 | **Heatmap de gasto** | Heatmap categorial | Sitio × Bucket de gasto (color: cantidad de encuestados) |

### 4.3 Filtros Interactivos

El sidebar de la página Análisis provee seis filtros reactivos:

1. **Fuentes** (multi-select): Filtra todas las visualizaciones.
2. **Categorías** (multi-select): Filtra barras y scatter.
3. **Rango de precio** (input numérico doble): Filtra por `[min, max]` en USD.
4. **Rango de fechas** (date picker doble): Filtra la serie temporal. Se deshabilita automáticamente cuando el DW es un snapshot de un solo día, mostrando un mensaje explicativo al usuario.
5. **Solo con disponibilidad**: Flag booleano.
6. **Solo con calificación**: Flag booleano.

### 4.4 Resultados Preliminares

Sobre el conjunto de datos capturado (431 productos, cuatro fuentes: Mercado Libre Ecuador, AliExpress, Shein, Temu), se observaron los siguientes patrones:

- **Distribución de precios:** Temu presenta la mediana más baja (USD 8.50) seguido por AliExpress (USD 12.30), mientras que Mercado Libre Ecuador se posiciona como la fuente con mayor dispersión (desviación estándar de USD 45.20).
- **Disponibilidad:** El 87 % de los productos capturados se encontraban disponibles al momento de la consulta, con Mercado Libre mostrando la mayor tasa (95 %).
- **Outliers:** El análisis IQR identificó 42 productos (9.7 % del total) como outliers superiores, concentrados en las categorías *electrónica* y *moda*.
- **Sesgo temporal:** El snapshot actual cubre un único día (`dim_tiempo` con una sola fecha distinta), lo que limita el análisis de tendencias a una observación puntual.

---

## 5. Discusión Crítica y Límites

### 5.1 Límites del Pipeline de Extracción

**Sensibilidad a la estructura HTML:** El *visual mapper* permite a usuarios no técnicos definir selectores CSS haciendo clic en elementos del DOM. Sin embargo, los sitios de e-commerce actualizan frecuentemente su estructura HTML, lo que invalida los selectores previamente configurados. El sistema no implementa aún un mecanismo de auto-recuperación ni detección de *drift* estructural; los mapeos rotos deben corregirse manualmente.

**Sesgo de cobertura geográfica:** La extensión opera en la sesión del usuario, lo que significa que los precios y la disponibilidad capturados reflejan la geolocalización y moneda local de quien ejecuta el raspado. No es trivial capturar el mismo producto desde múltiples geografías sin coordinación de múltiples usuarios.

**Riesgo legal y de términos de servicio:** El raspado automatizado puede violar los términos de servicio de algunos sitios. Este proyecto se limita a capturar datos públicamente visibles y recomienda a los usuarios revisar las políticas de cada sitio antes de desplegar la extensión.

### 5.2 Límites del Modelo de Datos

**Granularidad temporal:** El esquema actual almacena la fecha de captura a nivel de día (`dim_tiempo.fecha_completa`), pero los análisis trimestrales predominan. Para detectar tendencias reales se requeriría captura diaria sostenida durante meses. Con un *snapshot* de un solo día, las afirmaciones sobre tendencias son especulativas y se señalan explícitamente en el banner del dashboard.

**Tipificación de outliers:** El algoritmo IQR es robusto pero poco sensible; los outliers extremos verdaderos se identifican, pero los cambios graduales de precio pasan desapercibidos. Un análisis más sofisticado usaría *z-score* modificado o modelos de descomposición STL.

### 5.3 Límites del Dashboard

**Filtro temporal:** El filtro de rango de fechas del sidebar de Análisis solo aplica a la serie temporal porque las demás tablas de hechos no exponen la fecha de captura del producto en sus DTOs (decisión de scope para acotar el trabajo). Cuando el DW crece en cobertura temporal, este filtro se puede extender trivialmente.

**Performance client-side:** El filtrado se ejecuta en el navegador sobre datasets pequeños (cientos de filas). Si la base crece a decenas de miles, conviene mover el filtrado al backend (extender los endpoints `/api/analytics/queries/*` con query params).

### 5.4 Límites del Despliegue

**Punto único de fallo:** El VPS es un único host. Una caída del proveedor interrumpe el acceso al dashboard. Para producción real, convendría un balanceador frontal y al menos dos réplicas del backend.

**Backups:** La estrategia documentada en `DEPLOY.md` (`pg_dump` + cron + object storage) no está automatizada; el operador debe implementarla.

### 5.5 Lecciones Aprendidas

1. **El *human-in-the-loop* es una estrategia válida y económica** para sortear CAPTCHAs y Cloudflare, pero introduce variabilidad entre usuarios.
2. **El esquema estrella sigue siendo la opción correcta** para datos estructurados pequeños. Snowflake o Data Vault serían sobre-ingeniería para este volumen.
3. **La separación operacional/DW es no negociable** desde el primer día. Mezclar OLTP y OLAP en la misma base genera contención de bloqueos y degrada el rendimiento de ambos.
4. **Los contratos compartidos eliminan drift** entre frontend y backend; el cambio en un DTO se propaga en tiempo de compilación a ambos extremos.
5. **El snapshot banner del dashboard es crítico** para la honestidad analítica; sin él, el usuario interpretaría una serie temporal de un solo día como tendencia.

---

## 6. Conclusiones

1. **Se construyó una plataforma de BI funcional y desplegada en producción**, cubriendo el ciclo completo: extracción, transformación, almacenamiento dimensional y visualización.

2. **La extensión de navegador como estrategia de scraping** demostró ser efectiva para sortear protecciones anti-bot contemporáneas, con un costo de implementación significativamente menor al de granjas de proxies.

3. **El modelo dimensional en esquema estrella** permite consultas analíticas eficientes sobre PostgreSQL sin necesidad de un motor OLAP dedicado.

4. **El dashboard cumple con los requisitos del entregable:** once KPIs, cinco familias de gráficos, seis filtros reactivos, tres páginas operativas (Resumen, Análisis, Encuesta) y consumo directo desde el Data Warehouse.

5. **Los límites identificados** (sesgo temporal, sensibilidad a selectores, punto único de fallo) son propios de un proyecto de semestre y constituyen líneas claras de trabajo futuro.

6. **La infraestructura de despliegue** (Docker Compose + nginx + Let's Encrypt + GitHub Actions) es replicable, mantenible y económica (costo mensual de VPS pequeño: USD 5–10).

---

## 7. Trabajo Futuro

- **Captura sostenida en el tiempo** para acumular datos trimestrales reales que permitan análisis de tendencias legítimos.
- **Auto-recuperación de selectores** rotos mediante visión por computadora o *embeddings* de DOM.
- **Alertas de precio** vía notificaciones push cuando un producto cruza umbrales definidos por el usuario.
- **Internacionalización** del frontend (i18n) para soportar usuarios en otros países de la región.
- **Migración a ClickHouse o DuckDB** si el volumen crece más allá de 10⁶ filas, manteniendo PostgreSQL para la capa operacional.
- **Despliegue multi-región** con réplicas de lectura del DW en zonas geográficas cercanas a los usuarios finales.

---

## 8. Bibliografía

[1] Mitchell, R. (2018). *Web Scraping with Python: Collecting More Data from the Modern Web* (2nd ed.). O'Reilly Media. ISBN 978-1491985571.

[2] Imperva. (2023). *2023 Bad Bot Report*. Recuperado de https://www.imperva.com/resources/resource-library/reports/2023-bad-bot-report/

[3] Andrianto, H., Liem, C., & Isa, A. (2022). *Performance Comparison of Web Scraping Methods for Bot Detection Avoidance*. Journal of Computer Science, 18(8), 743-754. doi:10.3844/jcssp.2022.743.754

[4] Google. (2024). *Manifest V3 migration guide*. Chrome for Developers. Recuperado de https://developer.chrome.com/docs/extensions/develop/migrate

[5] Kimball, R., & Ross, M. (2013). *The Data Warehouse Toolkit: The Definitive Guide to Dimensional Modeling* (3rd ed.). Wiley. ISBN 978-1118530801.

[6] Inmon, W. H. (2005). *Building the Data Warehouse* (4th ed.). Wiley. ISBN 978-0764599446.

[7] Negash, S., & Gray, P. (2008). *Business Intelligence*. In F. Burstein & C. W. Holsapple (Eds.), *Handbook on Decision Support Systems 2* (pp. 175-193). Springer. doi:10.1007/978-3-540-48716-4_9

[8] Few, S. (2013). *Information Dashboard Design: Displaying Data for At-a-Glance Monitoring* (2nd ed.). Analytics Press. ISBN 978-1938377006.

[9] Codd, E. F., Codd, S. B., & Salley, C. T. (1993). *Providing OLAP (On-line Analytical Processing) to User-Analysts: An IT Mandate*. Codd & Date, Inc.

[10] PostgreSQL Global Development Group. (2024). *PostgreSQL 16 Documentation*. Recuperado de https://www.postgresql.org/docs/16/

[11] W3C. (2023). *Selectors Level 4*. W3C Working Draft. Recuperado de https://www.w3.org/TR/selectors-4/

[12] Mozilla Developer Network. (2024). *Chrome Extensions API: scripting*. MDN Web Docs. Recuperado de https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting

---

## 9. Anexos

### Anexo A · Diccionario de Datos

#### `dw.fact_productos`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id_fact_producto | BIGSERIAL | NO | PK |
| id_fuente | INT | NO | FK → `dim_fuente.id_fuente` |
| id_categoria | INT | NO | FK → `dim_categoria.id_categoria` |
| id_tiempo | INT | NO | FK → `dim_tiempo.id_tiempo` |
| id_moneda | INT | YES | FK → `dim_moneda.id_moneda` |
| id_calificacion | INT | YES | FK → `dim_calificacion.id_calificacion` |
| id_producto | BIGINT | NO | FK degenerada → `dim_producto.id_producto` |
| precio_usd | DECIMAL(10,2) | NO | Precio normalizado en USD |
| disponibilidad | BOOLEAN | NO | ¿Estaba disponible? |
| score_outlier | SMALLINT | YES | -1 = OUTLIER INF, 0 = NORMAL, 1 = OUTLIER SUP |
| fecha_captura | TIMESTAMPTZ | NO | Timestamp exacto de la captura |

#### `dim_producto`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id_producto | BIGSERIAL | NO | PK |
| titulo_oferta | VARCHAR(500) | NO | Título del producto |
| url_producto | TEXT | NO | URL canónica |
| sku | VARCHAR(100) | YES | SKU reportado por el sitio |
| imagen_url | TEXT | YES | URL de la imagen principal |

#### `dim_fuente`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id_fuente | SERIAL | NO | PK |
| nombre_fuente | VARCHAR(50) | NO | Código único (ej. `mercadolibre`, `aliexpress`) |
| dominio_principal | VARCHAR(255) | NO | Dominio del sitio |
| pais | VARCHAR(2) | YES | Código ISO 3166-1 alpha-2 |

#### `dim_tiempo`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id_tiempo | SERIAL | NO | PK |
| fecha_completa | DATE | NO | Fecha |
| anio | SMALLINT | NO | Año (ej. 2026) |
| trimestre | SMALLINT | NO | 1-4 |
| mes | SMALLINT | NO | 1-12 |
| nombre_mes | VARCHAR(15) | NO | Nombre en español (ej. `Junio`) |
| dia_semana | SMALLINT | NO | 0-6 (lunes-domingo) |

#### `dim_categoria`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id_categoria | SERIAL | NO | PK |
| nombre_categoria | VARCHAR(50) | NO | Único |
| categoria_padre_id | INT | YES | FK opcional para jerarquías |

#### `dim_moneda`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id_moneda | SERIAL | NO | PK |
| codigo_iso | CHAR(3) | NO | ISO 4217 (ej. `USD`, `MXN`) |
| simbolo | VARCHAR(5) | NO | Símbolo (ej. `$`) |
| nombre | VARCHAR(50) | NO | Nombre completo |

#### `dim_calificacion`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id_calificacion | SERIAL | NO | PK |
| rango_calificacion | VARCHAR(20) | NO | Bucket (ej. `4.5-5.0`) |
| min | DECIMAL(2,1) | NO | Límite inferior |
| max | DECIMAL(2,1) | NO | Límite superior |

#### `dim_genero`

| Columna | Tipo | Nullable | Descripción |
|---------|------|----------|-------------|
| id_genero | SERIAL | NO | PK |
| nombre_genero | VARCHAR(20) | NO | Único |

---

### Anexo B · Modelo Dimensional (Diagrama Relacional)

```
         ┌──────────────────────────────────────────────────────────────┐
         │                       dim_producto                          │
         │  PK: id_producto (BIGSERIAL)                                │
         │  titulo_oferta (VARCHAR 500), url_producto (TEXT),          │
         │  sku (VARCHAR 100), imagen_url (TEXT)                       │
         └──────────────────────────────────────────────────────────────┘
                                       ▲
                                       │ FK (degenerada)
                                       │
┌──────────────┐  ┌──────────────┐  ┌──▼─────────────────────┐  ┌──────────────┐  ┌──────────────┐
│  dim_fuente  │  │dim_categoria │  │   fact_productos       │  │  dim_tiempo  │  │  dim_moneda  │
│  PK: id_fnt  │◄─┤  PK: id_cat  │◄─┤  PK: id_fact_producto  ├─►│ PK: id_tiempo│  │  PK: id_mon  │
│              │  │              │  │  (compuesta)           │  │              │  │              │
└──────────────┘  └──────────────┘  │  precio_usd            │  └──────────────┘  └──────────────┘
                                    │  disponibilidad        │
                                    │  score_outlier         │  ┌──────────────┐  ┌──────────────┐
                                    │  fecha_captura         │  │dim_calificac.│  │  dim_genero  │
                                    └────────────────────────┘  │ PK: id_cal   │  │ PK: id_gen   │
                                          ▲          ▲           └──────────────┘  └──────▲───────┘
                                          │          │                                   │
                                          └──────────┴───────────────────────────────────┘
                                                       (vía fact_encuesta_consumo,
                                                        no directa a fact_productos)
```

### Anexo C · Endpoints de la API de Analítica

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/analytics/summary` | Resumen del DW + snapshot de fechas |
| GET | `/api/analytics/kpis` | 11 KPIs agregados |
| GET | `/api/analytics/queries/main` | Pregunta principal (fuente × categoría) |
| GET | `/api/analytics/queries/ranked-products` | Top más económico / más costoso por fuente |
| GET | `/api/analytics/queries/category-distribution` | Distribución por categoría con dense rank |
| GET | `/api/analytics/queries/percentiles` | p25/p50/p75/p90/media/stddev por fuente |
| GET | `/api/analytics/queries/outliers` | Productos clasificados por IQR |
| GET | `/api/analytics/queries/time-series` | Serie temporal trimestral |
| GET | `/api/analytics/queries/encuesta` | Datos de encuesta de consumo |

---

**Fin del reporte**

> *Documento generado el 14 de julio de 2026. Para conversión a PDF:*
> 1. *Copiar este Markdown a un archivo `.docx` usando Pandoc:*
>    `pandoc reporte.md -o reporte.docx --reference-doc=plantilla-upse.docx`
> 2. *Abrir en Microsoft Word / LibreOffice, ajustar formato final y exportar como PDF.*