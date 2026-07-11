# Índice de propuestas y planes — estado de implementación

Auditoría cruzada contra el código actual en `develop` (commit `463e72f`), historial
de git y memoria de sesiones (Engram). Clasificación en tres carpetas:

- **`aplicado/`** — implementado y verificado en el código actual.
- **`pendiente/`** — sigue vigente pero no (del todo) implementado.
- **`obsoleto/`** — superado por una decisión de diseño posterior o nunca llevado
  a esa forma concreta.

Los docs que no son propuestas (no tienen "estado de implementación") viven en dos
carpetas aparte:

- **`referencia/`** — arquitectura y documentación descriptiva del sistema
  (`architecture.md`, `backend.md`, `database.md`, `docker.md`, `frontend.md`,
  `worker.md`, `workflow.md`, `flows-current.md`). Ojo: la mayoría son del 7 jul,
  **anteriores** a Fase 0 (split de bases), Fase 1a (Sources/Categories/Brands/
  RawCaptures) y la consolidación del pipeline — probablemente desactualizados.
- **`entregables/`** — entregas académicas congeladas (`E3_CHECKLIST.md`,
  `ENTREGA_E5.md`, `Entregable4_DataWarehouse_Analitica.md`,
  `Reporte_Entregable5.md`, `Reporte_E3_Pipeline_Calidad.md`, PDFs/DOCX). Son
  registro histórico de una entrega ya calificada, no se actualizan.

| Documento | Estado | Justificación |
|---|---|---|
| [`aplicado/PLAN-Fase0-split-bases.md`](aplicado/PLAN-Fase0-split-bases.md) | ✅ Aplicado | Los 5 pasos verificados en código: `docker-compose.yml` tiene `postgres` + `postgres-dw` separados, `backend/prisma/{operational,analytics}/schema.prisma` split, `OperationalPrismaService`/`AnalyticsPrismaService` separados en `common/prisma/`. |
| [`aplicado/PLAN_CONSOLIDACION_PIPELINE.md`](aplicado/PLAN_CONSOLIDACION_PIPELINE.md) | ✅ Aplicado | `pipeline-scripts-bridge.ts` ya no existe, scrapers nativos en `backend/src/modules/pipeline/scraping/` (mercadolibre.ts, aliexpress.ts apuntando a `aliexpress.com` real, no `books.toscrape`), `BrowserFactoryService` con stealth, sin fallback a `quotes.toscrape.com`, `legacy/pipeline/` archivado (no borrado, como recomendaba el doc). |
| [`aplicado/propuesta-integracion-dw-nestjs.md`](aplicado/propuesta-integracion-dw-nestjs.md) | ✅ Aplicado | `AnalyticsModule`/`AnalyticsController`/`AnalyticsService`/`AnalyticsQueryService`/`DwLoaderService` existen con endpoints casi idénticos a los propuestos (`/kpis`, `/kpis/:name`, `/queries/*`, `/summary`, `/refresh-mv`, `/load`). |
| [`aplicado/PLAN_Entregable5_Dashboard_Reporte.md`](aplicado/PLAN_Entregable5_Dashboard_Reporte.md) | ✅ Aplicado (parcial) | Dashboard Angular (`pages/dashboard/{resumen,analisis,encuesta}`) y `ng-apexcharts`/`apexcharts` instalados tal cual se planeó. **Gap:** el destino de deploy cambió — el plan asumía Neon + Render + Vercel, pero la arquitectura actual (post Fase 0) es self-hosted vía Docker Compose (`postgres` + `postgres-dw` + `backend` + `frontend`), no hay referencias a Neon/Render/Vercel en el repo. |
| [`aplicado/REVIEW-2026-07-03.md`](aplicado/REVIEW-2026-07-03.md) | ✅ Aplicado | Los 4 críticos (C1 orden de rutas, C2 sin auth/CORS abierto, C3 heurística de título, C4 URL hardcodeada) están resueltos: ruta renombrada a `by-domain/:id`, `JwtAuthGuard` global, `ingestFromExtension` usa `canonicalField`, popup lee `chrome.storage.local`. `ScrapingJobsModule`/`SchedulesModule` removidos (comentario explícito en `app.module.ts`: "removed in review batch 4"). |
| [`aplicado/REVIEW-2026-07-10-modelo-datos.md`](aplicado/REVIEW-2026-07-10-modelo-datos.md) | ✅ Aplicado (parcial) | La recomendación principal ("separar físicamente operacional/analítica") se ejecutó (Fase 0), y `DwLoaderService` (T6.5, que el doc marcaba pendiente) ya está implementado y wireado en `pipeline.module.ts`. **Gap sin resolver:** el modelo `EtlProduct` que el doc señalaba como redundante con `Product` sigue en el schema (`backend/prisma/operational/schema.prisma:145`) sin ningún uso en `backend/src` — la decisión de qué hacer con él nunca se tomó. |
| [`pendiente/DISENO-modelo-datos-2db.md`](pendiente/DISENO-modelo-datos-2db.md) | 🟡 Pendiente | La Fase 0 (split físico) y buena parte de la Fase 1 (`Source`, `Category`, `Brand`, `RawCapture` — implementados vía SDD `fase1a-modelo-operacional`, PR #12/#13/#14) ya están. **Lo central sigue sin hacer:** el rework de identidad `Product` → `Product` + `Offer` + rename `PriceHistory` → `PriceObservation` (el propio doc lo marca como "el punto difícil"), y la Fase 2 (agregar `dim_marca` al DW — confirmado ausente en `backend/prisma/analytics/schema.prisma`, solo existen las 7 dimensiones originales). |
| [`obsoleto/propuesta_integracion_pipeline.md`](obsoleto/propuesta_integracion_pipeline.md) | ⚫ Obsoleto | Proponía un `EtlModule`/`EtlController` con endpoints `/api/etl/run` y `/api/etl/status` + panel Angular con botón "Sincronizar Ahora". Nada de eso existe (0 coincidencias en el repo). Superado por el diseño concreto de `PLAN_CONSOLIDACION_PIPELINE.md`, que se implementó como `PipelineModule`/`PipelineController` bajo `/api/pipeline/*` con una forma distinta (sin panel de administración dedicado en el frontend). |

## Notas de confianza

Todas las clasificaciones se verificaron contra código real (grep/read de archivos
concretos), no solo contra los checkboxes de cada doc — varios docs se autodeclaran
"✅ COMPLETADO" y esa afirmación se confirmó por separado en el código, no se tomó
de forma ciega.
