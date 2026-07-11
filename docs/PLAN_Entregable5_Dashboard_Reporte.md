# PLAN — Entregable 5: Dashboard Funcional y Reporte

**Asignatura:** VI Inteligencia de Negocios · Ingeniería de Software
**Institución:** Universidad Estatal Península de Santa Elena (UPSE)
**Paralelo:** Software 6/1
**Plazo:** Martes 14 de julio de 2026 (improrrogable) — hoy es Martes 7 de julio, **D-7**
**Peso:** 15% de la nota final
**Stack elegido:** **Angular 22 + NestJS 11 + Prisma 7.8 + Postgres (Neon free)**

> Este plan se construye sobre el **Entregable 4 (DW + Analítica)** ya entregado y validado, e implementa la **Propuesta de Integración DW↔NestJS** escrita por el equipo pero no codificada todavía. No se rehace nada que ya existe: se **integra, expone y consume**.

---

## 0. Resumen ejecutivo

| | |
|---|---|
| **Qué entregar** | (A) Dashboard URL pública en frontend Angular con ≥5 KPIs, 3 familias de gráficos, filtros reactivos, multi-página, leyendo vía endpoints REST del backend NestJS que consulta el DW · (B) Reporte tipo artículo científico sobre plantilla UPSE con ≥10 referencias y discusión explícita |
| **Stack** | Angular 22 (frontend) + NestJS 11 (backend) + Prisma 7.8 + Neon Postgres serverless (BD con `dw.*`) |
| **Charts** | **ng-apexcharts** (UI limpia, bundle ~350 KB, scatter + heatmap + box nativos) |
| **Por qué esta ruta (Ruta B)** | Coherencia absoluta con el stack académico. Reusa los `@web-scraping/contracts` ya migrados (cambio `frontend-backend-ambiguity`). El backend ya tiene JWT/Prisma/Schedule/Swagger. Riesgo medio a 7 días por superficie de deploy fullstack. |
| **Salida Lunes 13** | Frontend en Vercel + Backend en Render + PDF reporte + Video demostrativo |
| **Salida Martes 14 AM** | Submit en plataforma UPSE |

---

## 1. Diagnóstico del estado actual

### 1.1 Lo que YA está hecho (no se rehace)

| Artefacto | Ubicación | Estado |
|---|---|---|
| DW con modelo estrella (7 dim + 2 hechos) | `dw.*` en Postgres `scraperdb` | ✅ Cargado |
| 6 vistas de KPIs | `dw.v_kpi_*` | ✅ Definidas |
| Vista materializada | `dw.mv_resumen_precios` | ✅ Definida |
| 7 consultas analíticas validadas | `docs/Entregable4_DataWarehouse_Analitica.md` §4 | ✅ Documentadas |
| 6 hallazgos cuantitativos | E4 §6 | ✅ Documentados |
| 168 productos + 24 encuestas | `dw.fact_productos`, `dw.fact_encuesta_consumo` | ✅ Cargados |
| Pipeline ETL Staging → DW | `backend/pipeline/scripts/dw/` | ✅ Funcional |
| NestJS backend con Prisma, Swagger, Schedule | `backend/` | ✅ Operativo |
| `@web-scraping/contracts` con DTOs | `packages/contracts/` | ✅ Operativo (cambio SDD previo) |
| Frontend Angular 22 con Signals + standalone | `frontend/` | ✅ Operativo |
| Auth JWT | `backend/src/modules/auth/` | ✅ Operativo |
| Propuesta DW↔NestJS escrita | `docs/propuesta-integracion-dw-nestjs.md` | ✅ Diseñada, ❌ NO implementada |

### 1.2 Lo que FALTA para el Entregable 5 (Ruta B)

| Gap | Esfuerzo | Bloqueante |
|---|---|---|
| Implementar `AnalyticsModule` en backend (schema Prisma DW + controller + 2 services + DwLoader) | ~975 líneas — **1.5 días** | SÍ |
| Añadir DTOs analytics a `@web-scraping/contracts` (kpi-response, analytical-query-response) | ~150 líneas — **0.25 días** | SÍ |
| Crear `pages/dashboard/*` en Angular con 3 rutas (Resumen, Análisis, Encuesta) | ~700 líneas — **1.5 días** | SÍ |
| Instalar + integrar librería de charts | **0.25 días** | SÍ (elección) |
| DW expuesto fuera de `localhost` (Neon + migrate) | **0.25 días** | SÍ |
| Deploy fullstack público (Render + Vercel) | **0.5 días** | SÍ |
| Reporte con plantilla UPSE formal | **3 días** | SÍ |
| Plantilla UPSE oficial en el repo (NO está) | Tarea previa | SÍ — pedir HOY |
| Mínimo 10 referencias IEEE/APA | Incluido en reporte | SÍ |
| Sección Discusión formal | Incluido en reporte | SÍ — evitar -15% |

**Total esfuerzo**: ~7.25 días concentrados en 7 días reales → apretado pero viable.

### 1.3 Limitaciones reconocidas (entran a Discusión tal cual)

1. **`DimTiempo` con una sola fecha** → serie temporal real imposible; alternativa: serie por `trimestre` con banner "snapshot".
2. **88.1% de productos como "otros"** → clasificador E3 limitado; el reporte lo asume como oportunidad.
3. **Solo AliExpress aporta calificación + disponibilidad** → 33.3% del total.
4. **Volumen bajo** (168 productos / 24 encuestas) → falta de potencia estadística.
5. **Sesgo de autoselección en encuesta** → muestra por conveniencia (estudiantes UPSE).

---

## 2. Decisión estratégica: arquitectura del cambio

### 2.1 Nombre del cambio SDD
**`bi-dashboard-dw-nestjs`** — un solo cambio, fullstack, con dos sub-módulos entregables:

```
backend/src/modules/analytics/    ← Nuevo módulo
frontend/src/app/pages/dashboard/ ← Nueva ruta
packages/contracts/src/analytics/ ← DTOs compartidos
```

### 2.2 Estrategia técnica (Ruta B)

```
┌────────────────────────────────────────────────────────────────────┐
│                  Frontend Angular 22 (Vercel/Netlify)              │
│                                                                    │
│  /dashboard/resumen       ← 7 KPI cards + filtros globales        │
│  /dashboard/analisis      ← 3 familias de gráficos                │
│  /dashboard/encuesta      ← Barras + heatmap género×sitio         │
│                                                                    │
│  HttpClient → /api/analytics/* (JWT si admin, @Public si lectura)  │
└────────────────────────┬───────────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────────┐
│                  Backend NestJS 11 (Render/Railway)               │
│                                                                    │
│  AnalyticsModule (NUEVO)                                            │
│  ├── AnalyticsController  GET /api/analytics/kpis                  │
│  │                          GET /api/analytics/queries/:id         │
│  │                          POST /api/analytics/load               │
│  ├── AnalyticsService        (Prisma ORM: KPIs simples)            │
│  ├── AnalyticsQueryService  ($queryRawUnsafe: consultas complejas) │
│  ├── DwLoaderService        (staging → DW)                        │
│  └── DTOs en @web-scraping/contracts                              │
│                                                                    │
│  PrismaService (existente) ahora maneja:                           │
│  ├── public.*  → módulos operacionales                            │
│  └── dw.*      → NEW con @@schema("dw") en schema.prisma          │
└────────────────────────┬───────────────────────────────────────────┘
                         │
┌────────────────────────▼───────────────────────────────────────────┐
│                  PostgreSQL — Neon free tier                       │
│  Esquema public:  User, DomainRule, Product, PriceHistory, Etl...  │
│  Esquema dw:      dim_* (7), fact_* (2), v_kpi_* (6), mv_* (1)    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.3 Bifurcaciones técnicas resueltas / pendientes

| Decisión | Recomendación | Por qué |
|---|---|---|
| Auth en endpoints analytics | **`@Public()`** (lectura) para que el dashboard sea accesible sin login | Compatible con requisito "URL pública" y evita fricción de demo |
| ORM para DW | **Prisma ORM** para dimensiones + **`$queryRawUnsafe`** para queries complejas (window functions, percentiles) | Mejor de los dos mundos — exactamente lo que la Propuesta recomienda |
| Hosting backend | **Render** free tier (NestJS nativo, respeta `pnpm start`) | Más simple que Railway para Node. Sleep después de 15 min — aceptable |
| Hosting frontend | **Vercel** (Angular CLI nativo) | Mejor DX para Angular static builds |
| Hosting BD | **Neon** (Postgres serverless free, sin sleep) | Más predecible que Render Postgres |
| Filtros reactivos | **Angular Signals + `toSignal(http$)`** | Estado idiomático Angular 22; evita `subscribe` manuales |
| Charts library | ✅ **ng-apexcharts** | Bundle chico (~350 KB), UI moderna, series/scatter/heatmap nativos |

---

## 3. Roadmap por fases (D-7 → D-1) — Ruta B

> Cada fase entrega un producto verificable. Si una falla, hay punto de rollback claro.

### Fase 0 — D-7 (HOY): Insumos bloqueantes · paralelo

| # | Tarea | Entregable | Tiempo |
|---|---|---|---|
| 0.1 | Conseguir **plantilla UPSE oficial** del aula virtual / docente | `.docx` oficial | 1 h |
| 0.2 | Definir integrantes y roles en portada | Lista confirmada | 30 min |
| 0.3 | Crear cuenta Neon + proyecto `upse-bi-2026` | URL de conexión | 30 min |
| 0.4 | Crear cuentas Render + Vercel (vinculadas a GitHub) | Servicios listos | 30 min |
| 0.5 | ✅ Decidir librería de charts — **TOMADA: ng-apexcharts** | — | 0 min |
| 0.6 | Snapshot del DW local en `backend/pipeline/scripts/dw/dw_dump.sql` | Dump ejecutable | 15 min |

### Fase 1 — D-6 (Miércoles 8): Schema Prisma + migración a Neon

| # | Tarea | Archivos | Tiempo |
|---|---|---|---|
| 1.1 | Añadir los 8 modelos DW al `backend/prisma/schema.prisma` con `@@schema("dw")` | `backend/prisma/schema.prisma` | 2 h |
| 1.2 | `pnpm prisma:generate` → verificar tipos generados para `dw.DimProducto`, etc. | — | 30 min |
| 1.3 | Crear rama `feat/bi-analytics-schema` + commit | Git | 15 min |
| 1.4 | Dump local: `pg_dump -h localhost -p 5433 -U scraper -d scraperdb --schema=only dw` y `pg_dump --data-only` | 2 archivos `.sql` | 30 min |
| 1.5 | `CREATE SCHEMA dw;` en Neon + restore del dump | Neon DB poblada | 1 h |
| 1.6 | DBeaver → Neon → `SELECT * FROM dw.v_kpi_precio_promedio_categoria` debe devolver 5-6 filas | Validación | 15 min |
| 1.7 | Cambiar `DATABASE_URL` en `.env` apuntando a Neon (temporal) y `pnpm dev:backend` arranca | Backend conecta a Neon | 30 min |
| 1.8 | **Revertir `.env` a localhost** antes del commit — Neon URL va a env vars de Render | Git | 5 min |

### Fase 2 — D-5 (Jueves 9): Backend AnalyticsModule + DTOs en contracts

| # | Tarea | Archivos | Tiempo |
|---|---|---|---|
| 2.1 | Añadir DTOs analytics a `packages/contracts/src/analytics/` | `kpi-response.dto.ts`, `query-response.dto.ts`, `load-dw.dto.ts` | 2 h |
| 2.2 | Crear `backend/src/modules/analytics/analytics.module.ts` | `analytics.module.ts` | 30 min |
| 2.3 | Crear `analytics.controller.ts` con los 11 endpoints según propuesta | `analytics.controller.ts` (120 líneas) | 3 h |
| 2.4 | Crear `analytics.service.ts` con `getAllKpis()` y `getKpi(name)` | `analytics.service.ts` (60 líneas) | 1 h |
| 2.5 | Crear `analytics-query.service.ts` con los 7 métodos raw SQL del E4 §4 | `analytics-query.service.ts` (200 líneas) | 3 h |
| 2.6 | Crear `dw-loader.service.ts` (paridad con `backend/pipeline/scripts/dw/dw_load_staging.ts`) | `dw-loader.service.ts` (250 líneas) | 3 h |
| 2.7 | Registrar `AnalyticsModule` en `app.module.ts` | `backend/src/app.module.ts` | 5 min |
| 2.8 | Tests unitarios de los 7 métodos del query service (RED-first) | `*.spec.ts` | 4 h |
| 2.9 | Test e2e `analytics.e2e-spec.ts` con `supertest` | `backend/test/analytics.e2e-spec.ts` | 2 h |
| 2.10 | `pnpm dev:backend` + verificar Swagger UI en `/api/docs` muestra `/analytics/*` | Screenshot | 15 min |
| 2.11 | Commit en rama `feat/bi-analytics-backend`, push, abrir PR (NO mergear hasta Fase 3) | Git + GitHub | 15 min |

**Punto de control D-5**: ¿`GET /api/analytics/kpis` devuelve las 6 vistas reales? Si NO, debugging 24h antes de seguir.

### Fase 3 — D-4 (Viernes 10): Frontend dashboard Angular multi-página

| # | Tarea | Archivos | Tiempo |
|---|---|---|---|
| 3.1 | Instalar `ng-apexcharts`: `pnpm add apexcharts ng-apexcharts` + importar `NgApexchartsModule` (o componente standalone `apx-chart`) | `frontend/package.json` | 15 min |
| 3.2 | Crear `frontend/src/app/pages/dashboard/` con estructura standalone | scaffold | 30 min |
| 3.3 | Crear `dashboard.routes.ts` con 3 rutas hijas (lazy loading) | rutas | 30 min |
| 3.4 | Página 1 `pages/dashboard/resumen/` — 7 KPI cards con `@for` + skeletons | componentes | 3 h |
| 3.5 | Página 2 `pages/dashboard/analisis/` — 3 familias de gráficos con la lib elegida | componentes | 5 h |
| 3.6 | Página 3 `pages/dashboard/encuesta/` — barras apiladas + heatmap | componentes | 2 h |
| 3.7 | `KpiFiltersService` reactivo con `signal()` para fuente/categoría/precio/disponibilidad | servicio global | 1.5 h |
| 3.8 | Componente `KpiCard` reutilizable con loading + error states | componente compartido | 1 h |
| 3.9 | `dashboardService.ts` que llama a `HttpClient` con retry + cache 5 min | servicio | 1.5 h |
| 3.10 | Estilo: header con logo UPSE + autores + última fecha de refresh | layout | 1 h |
| 3.11 | `pnpm build:frontend` compila sin errores | build OK | 15 min |
| 3.12 | Tests con vitest para `KpiCard` + `KpiFiltersService` | specs | 2 h |

**Punto de control D-4**: ¿Las 3 rutas cargan datos reales desde el backend? ¿Los filtros reactivos refrescan gráficos?

### Fase 4 — D-3 (Sábado 11) y D-2 (Domingo 12): Reporte de investigación

| # | Tarea | Entregable |
|---|---|---|
| 4.1 | **Portada oficial UPSE** con plantilla (1) | Portada lista |
| 4.2 | **Abstract** 150-200 palabras (2): problema + método + 3 hallazgos top + conclusión | Abstract pulido |
| 4.3 | **Introducción y Justificación** (3): contexto, problema, motivación BI | 2-3 páginas |
| 4.4 | **Marco Teórico** (4) — 4+ subtemas | 4-5 páginas |
| 4.5 | **Metodología e Infraestructura** (5): pipeline + arquitectura fullstack + decisiones de stack | 3-4 páginas |
| 4.6 | **Análisis y KPIs** (6): resultados del E4 + screenshots del nuevo dashboard | 4-5 páginas |
| 4.7 | **Discusión crítica y límites** (7): tocar las 5 limitaciones de §1.3 explícitamente | 2-3 páginas |
| 4.8 | **Conclusiones explícitas** (8): responder las preguntas de investigación del E1 | 1-2 páginas |
| 4.9 | **Bibliografía** (9): 10+ fuentes IEEE/APA (12 con buffer) | 2 páginas |
| 4.10 | **Anexos** (10): diagrama estrella + diccionario + screenshots dashboard + queries SQL | 3-5 páginas |

### Fase 5 — D-1 (Lunes 13): Deploy fullstack + QA + Video

| # | Tarea | Entregable |
|---|---|---|
| 5.1 | Push a `main` → Render auto-deploy del backend | URL `https://upse-bi-2026.onrender.com` |
| 5.2 | Push a `main` → Vercel auto-deploy del frontend Angular | URL `https://upse-bi-2026.vercel.app` |
| 5.3 | Configurar CORS en NestJS para permitir el origen Vercel | código + config | 15 min |
| 5.4 | Configurar env vars de Render con `DATABASE_URL` de Neon | Render dashboard | 15 min |
| 5.5 | Smoke test: cargar dashboard, mover filtros, validar KPIs reales en producción | Video-cap OK | 1 h |
| 5.6 | Convertir reporte `.docx` → `.pdf` (LibreOffice o pandoc) | PDF 25-35 páginas | 1 h |
| 5.7 | Video demostrativo 3-5 min (OBS): dashboard en acción + lectura de insight | MP4 / YouTube | 2 h |
| 5.8 | Auto-evaluación con checklist del enunciado (ver §8) | Checklist firmado | 30 min |
| 5.9 | Subida a plataforma UPSE | Submit ready | 30 min |

### Fase 6 — D-0 (Martes 14 AM): Entrega

- Confirmación final del submit.
- Respaldo en README: URL backend + URL frontend + PDF + link video + командоs de ejecución local.

---

## 3.1 Decisión de librería de charts — TOMADA: ng-apexcharts

**Por qué `ng-apexcharts`:**
- UI moderna y limpia = visualmente presentable para entrega académica formal sin esfuerzo de estilado.
- Bundle ~350 KB (mejor perf que ngx-echarts ~900 KB).
- Soporta nativamente: `bar`, `line`, `area`, `scatter`, `bubble`, `heatmap`, `boxPlot`, `radialBar`, `pie`, `donut`, `rangeBar`, `rangeArea`, `treemap`.
- API declarativa vía objeto `chart` + `series` + `xaxis` — legible en code review.
- Wrapper Angular oficial mantenido activamente.

**Configuración típica en componente standalone:**

```typescript
import { Component } from '@angular/core';
import { NgApexchartsModule } from 'ng-apexcharts';
import type { ChartOptions } from 'apexcharts';

@Component({
  standalone: true,
  imports: [NgApexchartsModule],
  template: `
    <apx-chart
      [chart]="{ type: 'bar', height: 320 }"
      [series]="[{ name: 'Precio', data: [...] }]"
      [xaxis]="{ categories: [...] }">
    </apx-chart>
  `,
})
export class PrecioPorFuenteComponent {
  readonly chartOptions: ChartOptions = { /* ... */ };
}
```

**Riesgos mitigados:**
- ✅ Heatmap soportado nativamente (`type: 'heatmap'`)
- ✅ Box plot soportado (`type: 'boxPlot'`)
- ⚠️ Si SSR activo: importar solo en `afterNextRender()` para evitar `window is not defined`

---

## 4. PARTE A — Dashboard: especificación operativa

### 4.1 Estructura de archivos nueva

```
backend/src/modules/analytics/
├── analytics.module.ts
├── analytics.controller.ts        # 11 endpoints según propuesta §4.5
├── analytics.service.ts           # getAllKpis(), getKpi(name)
├── analytics-query.service.ts     # 7 métodos raw SQL del E4 §4
├── dw-loader.service.ts           # staging → dw
├── dto/
│   ├── kpi-response.dto.ts
│   ├── analytical-query.dto.ts
│   └── load-dw.dto.ts
├── analytics.service.spec.ts
├── analytics-query.service.spec.ts
└── dw-loader.service.spec.ts

backend/test/analytics.e2e-spec.ts

packages/contracts/src/analytics/
├── kpi.dto.ts                     # KpiResponse, KpiItem
├── query.dto.ts                   # PreguntaPrincipalResponse, etc.
└── index.ts

frontend/src/app/pages/dashboard/
├── dashboard.routes.ts            # 3 rutas lazy
├── core/
│   ├── dashboard.service.ts       # HttpClient + retry
│   ├── kpi-filters.service.ts     # signal<Filters>
│   └── models/
│       ├── kpi.model.ts
│       └── filter.model.ts
├── shared/
│   ├── kpi-card/
│   │   ├── kpi-card.component.ts  # standalone
│   │   └── kpi-card.component.spec.ts
│   └── chart-host/
│       └── chart-host.component.ts
├── pages/
│   ├── resumen/
│   │   └── resumen.page.ts        # 7 KPI cards
│   ├── analisis/
│   │   └── analisis.page.ts       # 3 familias de gráficos
│   └── encuesta/
│       └── encuesta.page.ts       # 3 gráficos de comportamiento
└── layout/
    └── dashboard-layout.component.ts  # sidebar + header
```

### 4.2 Mapeo KPIs ↔ vista SQL ↔ componente Angular

| KPI (requisito) | Vista SQL | Endpoint REST | Componente Angular |
|---|---|---|---|
| 1 — Precio promedio por categoría | `dw.v_kpi_precio_promedio_categoria` | `GET /api/analytics/kpis/precio-categoria` | `<kpi-card>` con sparkline |
| 2 — Distribución por fuente | `dw.v_kpi_distribucion_fuentes` | `GET /api/analytics/kpis/distribucion-fuentes` | `<kpi-card>` + mini bar |
| 3 — Completitud de datos | `dw.v_kpi_completitud_datos` | `GET /api/analytics/kpis/completitud` | `<kpi-card>` con gauge |
| 4 — Rango de precios por fuente | `dw.v_kpi_rango_precios_fuente` | `GET /api/analytics/kpis/rango-precios` | `<kpi-card>` con min/max |
| 5 — Preferencia de plataformas | `dw.v_kpi_preferencia_plataformas` | `GET /api/analytics/kpis/preferencia` | `<kpi-card>` con % |
| 6 — Total productos en DW | `SELECT COUNT(*) FROM dw.fact_productos` | `GET /api/analytics/summary` | `<kpi-card>` big number |
| 7 — Total encuestas en DW | `SELECT COUNT(*) FROM dw.fact_encuesta_consumo` | `GET /api/analytics/summary` | `<kpi-card>` big number |

> **7 KPIs cubren los 5 mínimos con margen.** Ninguno hardcodeado: todos vienen de `SELECT` real al esquema `dw`.

### 4.3 Las 3 familias de gráficos (requisito cumplido)

| Familia | Gráfico | Endpoint backend |
|---|---|---|
| **Barras correlacionales** | Grouped bar: precio promedio × fuente × categoría | `GET /api/analytics/queries/main` |
| **Serie temporal limitada** | Line chart: precio promedio por **trimestre** (snapshot declarado en banner) | nueva query `getTimeSeriesByQuarter()` |
| **Diagrama de dispersión** | Scatter precio vs. calificación coloreado por fuente + box plot por fuente | `GET /api/analytics/queries/outliers` |
| (extra) Mapa / heatmap | Heatmap fuente × categoría (de la vista materializada) | `GET /api/analytics/queries/category-distribution` |

> La "serie temporal" se presenta como **distribución por trimestre** con banner: *"Snapshot de extracción 2026-06-30. Series temporales continuas requieren re-ejecuciones periódicas del ETL."* Esto preserva la honestidad científica y se convierte en discusión.

### 4.4 Filtros reactivos — Angular Signals

```typescript
// kpi-filters.service.ts
@Injectable({ providedIn: 'root' })
export class KpiFiltersService {
  readonly fuentes = signal<Fuente[]>(['mercadolibre','aliexpress','temu','shein','archivos']);
  readonly categorias = signal<Categoria[]>([...allCategorias]);
  readonly rangoPrecio = signal<[number, number]>([0, 1000]);
  readonly soloConDisponibilidad = signal(false);
  readonly soloConCalificacion = signal(false);

  // Cada componente consume con `effect()` y refetch automático
}
```

> Los filtros cambian `URL params` del `HttpClient` → `toSignal(http$)` → los gráficos se actualizan **en tiempo real sin reload**.

### 4.5 Conectividad probada — auditabilidad de "no CSV"

- **Prueba 1**: `pnpm dev` del backend, Swagger UI en `/api/docs` muestra los 11 endpoints `/api/analytics/*` con sus responses.
- **Prueba 2**: `curl http://localhost:3000/api/analytics/kpis` devuelve JSON real del `dw.*`.
- **Prueba 3**: en producción, el código de los services usa `prisma.$queryRawUnsafe(\`SELECT ... FROM dw.v_kpi_*\`)` — **verificable por auditoría del código**.
- **Anti-CSV**: en `code review`, ningún service importa `fs.readFile` ni lee de `backend/pipeline/staging/*.json`.

### 4.6 URL pública esperada

| Servicio | URL | Plan |
|---|---|---|
| Frontend | `https://upse-bi-2026.vercel.app` | Vercel free |
| Backend | `https://upse-bi-2026.onrender.com` | Render free (sleep 15 min — primer hit ~30s) |
| BD | `postgresql://...neon.tech/...` | Neon free, sin sleep |

> El dashboard público es la URL de Vercel; el reporte PDF incluye capturas con la URL impresa en el header.

---

## 5. PARTE B — Reporte: especificación operativa

### 5.1 Estructura — 10 secciones según rúbrica

| # | Sección | Páginas est. |
|---|---|---|
| 1 | Portada oficial UPSE | 1 |
| 2 | Abstract (150-200 palabras) | 1 |
| 3 | Introducción y Justificación | 2-3 |
| 4 | Marco Teórico (4+ subtemas) | 4-5 |
| 5 | Metodología e Infraestructura | 3-4 |
| 6 | Análisis y KPIs obtenidos | 4-5 |
| 7 | Discusión crítica y límites | 2-3 |
| 8 | Conclusiones explícitas | 1-2 |
| 9 | Bibliografía (10+ fuentes IEEE/APA) | 2 |
| 10 | Anexos (modelo + diccionario + screenshots dashboard) | 3-5 |

**Total: ~25-35 páginas**.

### 5.2 Marco Teórico — los 4+ subtemas

1. **Inteligencia de Negocios (BI) y la Cadena de Valor del Dato** — Davenport, Kimball.
2. **Data Warehouse: arquitectura, modelo estrella y copo de nieve** — Kimball, Inmon.
3. **Procesos ETL vs. ELT en pipelines modernos** — staging zones, transformaciones.
4. **KPIs analíticos y métricas de rendimiento empresarial** — definición, fórmula, benchmark.
5. **(extra) Visualización de datos y percepción visual** — Few, Tufte.
6. **(extra) Scraping web visual y consideraciones éticas** — ToS, robots.txt, MV3.

### 5.3 Bibliografía — 10+ fuentes sugeridas (verificables)

1. Kimball, R. & Ross, M. (2013). *The Data Warehouse Toolkit* (3rd ed.). Wiley.
2. Inmon, W. H. (2005). *Building the Data Warehouse* (4th ed.). Wiley.
3. Davenport, T. & Harris, J. (2017). *Competing on Analytics*. Harvard Business Review Press.
4. Hernández-Sampieri, R. et al. (2014). *Metodología de la Investigación* (6th ed.). McGraw-Hill.
5. Few, S. (2012). *Show Me the Numbers* (2nd ed.). Analytics Press.
6. Tufte, E. R. (2001). *The Visual Display of Quantitative Information* (2nd ed.). Graphics Press.
7. PostgreSQL Global Development Group. (2026). *PostgreSQL 16 Documentation*.
8. Angular Team. (2026). *Angular 22 Documentation*. angular.dev.
9. NestJS Team. (2026). *NestJS 11 Documentation*. docs.nestjs.com.
10. Prisma Data Guide. (2026). *Prisma ORM Documentation*. prisma.io.
11. (extra) Gamma, E. et al. (1994). *Design Patterns*. Addison-Wesley.
12. (extra) W3C. (2024). *Web Components*.

### 5.4 Sección Discusión — limitaciones pre-identificadas

El texto de Discusión debe tocar OBLIGATORIAMENTE:

| Limitación | Cómo exponerla |
|---|---|
| `DimTiempo` con 1 fecha | "El snapshot del 2026-06-30 limita series temporales verdaderas. Solución: cron que re-ejecute el ETL periódicamente." |
| 88.1% en "otros" | "El clasificador E3 no cubre vocabulario en español. Futuras iteraciones deben integrar embeddings o diccionario bilingüe." |
| Brecha de metadatos | "Solo AliExpress aporta calificación (33.3%) y disponibilidad (33.3%). Las plataformas exigen migración a extracción de páginas de detalle." |
| Volumen bajo | "168 productos y 24 encuestas limitan la potencia estadística; un p-valor en prueba t requiere n≥30 por grupo." |
| Sesgo de autoselección | "La encuesta es a conveniencia (estudiantes UPSE), no probabilística → conclusiones sobre 'consumidor ecuatoriano' son preliminares." |
| **Ruta B específica**: deploy fullstack | "El acoplamiento backend-frontend fue explícitamente aceptado a costa de mayor superficie de fallo; alternativa de Plan B (instrucciones locales + video) está documentada." |

### 5.5 Anexos

- **Anexo A**: Diagrama del modelo estrella.
- **Anexo B**: Diccionario de datos (todas las tablas, columnas, tipos, FK).
- **Anexo C**: Screenshots del dashboard (1 por pestaña) numerados.
- **Anexo D**: Script de carga ETL (`dw_load_staging.ts` extracto).
- **Anexo E**: Queries SQL completas (las 7 del E4 §4) + nuevo `getTimeSeriesByQuarter`.
- **Anexo F**: Diagrama de arquitectura fullstack (Angular + NestJS + Neon).

---

## 6. Riesgos y mitigación

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| No conseguir plantilla UPSE | Media | Alto | Pedir HOY al aula virtual; alternativa: APA-7 estándar |
| Render free duerme después de 15 min (primer hit ~30s) | Alta | Bajo para funcional | Configurar healthcheck `/api/health` que Render wake-up cada 14 min |
| CORS bloquea Vercel → Render | Alta | Crítico | Configurar `app.enableCors({ origin: 'https://upse-bi-2026.vercel.app', credentials: true })` desde el inicio |
| Neon `@@schema("dw")` no soportado en Prisma 7.8 | Baja | Crítico | La propuesta §7.2 ya tiene plan alternativo: raw SQL sin modelos Prisma |
| `dw.fact_productos` Decimal serializa mal a JSON | Alta | Alto | Usar `serializeBigInts()` helper; replicar patrón del cambio `frontend-backend-ambiguity` |
| Vercel no detecta `pnpm` workspace | Media | Crónico | Documentado en guide; alternativa: deploy con `pnpm install --shamefully-hoist` o mover dashboard a repo standalone |
| URL del frontend caída al calificar | Baja | Crítico | Plan B: video + capturas en el PDF + instrucciones locales en README |
| Charts library no soporta heatmap | — | — | **Eliminado**: `ng-apexcharts` soporta `type: 'heatmap'` nativo |

### Plan B (si deploy falla):
1. Capturar screenshots del dashboard funcionando localmente (instrucciones en README).
2. Video demostrativo 3-5 min.
3. README con instrucciones precisas (`pnpm install`, `pnpm dev:backend`, `pnpm dev:frontend`, configurar `DATABASE_URL` apuntando a Neon).
4. Documentar todo en el reporte como "evidencia de ejecución local + pública".

### Checkpoints de paro
1. **Final D-6** — ¿Modelos DW en Prisma + Neon con datos restaurados? Si NO → debugging 24h o pivote a Ruta A.
2. **Final D-5** — ¿Endpoints `/api/analytics/*` devolviendo datos reales desde el backend local? Si NO → debugging 24h.
3. **Final D-4** — ¿Frontend renderiza las 3 rutas con datos reales? Si NO → recortar página de Encuesta (menos crítico) y avanzar reporte.
4. **Final D-2** — ¿Reporte en 70% de avance? Si NO → recortar Marco Teórico (a 4 subtemas) y Anexos.
5. **Final D-1** — ¿URL pública responde + PDF compila + video listo? Si NO → submit con PDF + capturas, video como "complemento".

---

## 7. Entregables concretos para Martes 14

| Entregable | Ubicación | Formato |
|---|---|---|
| Dashboard URL pública | `https://upse-bi-2026.vercel.app` | URL |
| Backend URL | `https://upse-bi-2026.onrender.com/api/docs` | URL Swagger |
| Código fuente | `main` branch del repo | Git |
| Reporte PDF | `docs/Reporte_Entregable5.pdf` | PDF (25-35 pp) |
| Video demostrativo | YouTube unlisted o MP4 | link |
| README de entrega | `docs/ENTREGA_E5.md` | MD |

---

## 8. Checklist final pre-entrega (auto-verificación)

### Requisitos Prácticos (Dashboard)

- [ ] URL externa plenamente funcional y pública
- [ ] Mínimo 5 KPIs reales (vamos por 7)
- [ ] Al menos 3 familias gráficas tituladas
- [ ] Filtros reactivos modificando vistas en tiempo real
- [ ] Consumo nativo desde DW — verificable por auditoría de código (sin `fs.readFile`)

### Requisitos Formales (Artículo)

- [ ] Estructura sobre plantilla UPSE oficial
- [ ] Mínimo 10 referencias (vamos por 12 buffer)
- [ ] Arquitectura lógica y diagramas del pipeline
- [ ] Sección Discusión explícita con sesgos identificados
- [ ] Anexos con diccionario de datos y modelo dimensional

### Validador de la rúbrica (35/30/20/15)

- **Dashboard Vivo (35%)**: ✓ 7 KPIs, ✓ 3 familias, ✓ multi-página, ✓ DW nativo
- **Estructura Académica (30%)**: ✓ plantilla UPSE, ✓ 12 refs, ✓ ortografía
- **Evidencia Científica (20%)**: ✓ 6 hallazgos cuantitativos, ✓ capturas dashboard
- **Discusión Crítica (15%)**: ✓ 6 limitaciones (5 datos + 1 arquitectónica)

---

## 9. Anexo: comandos clave

```bash
# Backend — dump DW local
pg_dump -h localhost -p 5433 -U scraper -d scraperdb --schema=dw \
  --no-owner --clean --if-exists > dw_schema.sql
pg_dump -h localhost -p 5433 -U scraper -d scraperdb --schema=dw \
  --data-only --no-owner > dw_data.sql

# Neon — restore
psql "postgresql://USER:PASS@HOST.neon.tech/dbname?sslmode=require" \
  -c "CREATE SCHEMA IF NOT EXISTS dw;"
psql "postgresql://USER:PASS@HOST.neon.tech/dbname?sslmode=require" \
  -f dw_schema.sql -f dw_data.sql

# Backend — regenerar Prisma con modelos DW
cd backend
pnpm prisma:generate
# (cambiar DATABASE_URL a Neon solo localmente para probar)
DATABASE_URL="postgresql://USER:PASS@HOST.neon.tech/dbname?sslmode=require" \
  pnpm dev:backend

# Frontend — build + deploy
cd frontend
pnpm install ngx-echarts   # o la lib elegida
pnpm build:frontend
vercel --prod

# Render — auto-deploy desde GitHub
# (configurar render.yaml con buildCommand, startCommand, envVars)
```

---

## 10. Decisión final

**Caminamos por Ruta B (Angular 22 + NestJS 11 + Prisma 7.8 + Neon + ng-apexcharts) con el cronograma de 7 días descrito**, sobre la base del cambio SDD `bi-dashboard-dw-nestjs`.

El equipo debe aceptar que:
1. **El cronograma es justo**. No hay colchón — cualquier desvío activa el recorte controlado.
2. **El reporte no se mueve** del cronograma (consume 3 días). Si backend o frontend se atrasan, se recorta otra cosa.
3. **Todas las bifurcaciones técnicas están resueltas** (hosting, ORM mixto, autenticación, filtros, charts). Foco 100% en ejecutar.

---

*Plan generado para Entregable 5 — UPSE · Inteligencia de Negocios · Semestre 2026-1*
*Basado en Entregable 4 (DW + Analítica) entregado 2026-07-07 y Propuesta DW↔NestJS pendiente de implementar*
