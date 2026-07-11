# Análisis del Modelo de Datos — Estado Actual

**Fecha:** 2026-07-10
**Tipo:** Auditoría del modelo de datos (Prisma + PostgreSQL)
**Relacionado:** `docs/REVIEW-2026-07-03.md` (auditoría integral previa), `openspec/changes/pipeline-consolidation/`

---

## TL;DR

El schema de Prisma (`backend/prisma/schema.prisma`) está bien diseñado: normalizado, con índices e integridad referencial correctos, y un modelo estrella (`dw`) técnicamente válido para el DW. El problema **no es el diseño del schema**, sino que una parte importante de las tablas está desconectada del código que debería alimentarlas — quedaron a mitad de camino cuando el proyecto se congeló para entregar el prototipo.

Dos schemas de Postgres conviven en una sola base de datos y un solo `datasource` de Prisma:

- **`public`** — operativo. `DomainRule`, `Product`, `PriceHistory`, `User` están vivos y en uso real.
- **`dw`** — analítico (modelo estrella). Diseño correcto, pero **sin loader activo**: los datos son un snapshot cargado a mano una sola vez.

---

## Inventario de modelos

### `public` (operativo) — en uso real

| Modelo | Usado en | Estado |
|---|---|---|
| `DomainRule` | `backend/src/modules/domains/domains.service.ts` | Activo |
| `Product` | `backend/src/modules/products/products.service.ts` | Activo |
| `PriceHistory` | `backend/src/modules/products/products.service.ts:128,245,267` | Activo |
| `User` | `backend/src/modules/auth/users.service.ts` | Activo (JWT, batch 6) |

Este es el circuito real: la extensión de scrapeo asistido escribe `DomainRule`/`Product`/`PriceHistory`, y `User` protege la API.

### `public` (ETL) — schema completo, ejecución rota

| Modelo | Se escribe? | Evidencia |
|---|---|---|
| `EtlRun` | Sí | `backend/src/modules/pipeline/etl-scheduler.service.ts:59,84` |
| `EtlProduct` | **No, nunca** | Ningún `prisma.etlProduct.*` en todo el repo fuera de specs |
| `QualityMetric` | **No, nunca** | Ningún `prisma.qualityMetric.*` en todo el repo fuera de specs |

**Causa raíz confirmada en código** (`etl-scheduler.service.ts:66-78`):

```ts
// 3. Stub: the bridge import was deleted in PR 1a; the actual
//    scraper wiring (AliExpressAdapter → STAGING_PROCESSOR →
//    QualityService → DW_LOADER) lands across PR 3, PR 4, and
//    PR 6. Until then the run is created, the throw fires, and
//    the catch marks the run as FAILED — no runtime crash.
throw new Error(
  'etl-scheduler: native scraper not wired yet; see PR 3 (MELI), PR 4 (AliExpress), PR 6 (ETL)',
);
```

El cron corre todas las noches (`0 2 * * *` por defecto), crea un `EtlRun`, tira este error a propósito, y lo marca `FAILED`. Nunca llega a escribir `EtlProduct`, `QualityMetric` ni el `dw`. Esto es intencional (stub documentado), no un bug oculto — pero significa que la tabla `EtlRun` hoy solo acumula filas `FAILED`.

Ya existe un plan escrito para cerrar esto: `openspec/changes/pipeline-consolidation/tasks.md:479`, tarea **T6.5** (`dw-loader.service.ts`, implementa `IDwLoader`), sin marcar como completada.

### `dw` (analítico) — modelo estrella correcto, datos congelados

7 dimensiones (`DimProducto`, `DimFuente`, `DimCategoria`, `DimTiempo`, `DimMoneda`, `DimCalificacion`, `DimGenero`) + 2 hechos (`FactProducto`, `FactEncuestaConsumo`). Bien modelado: granularidad clara, FKs correctas, índices en las columnas de filtrado típico (`id_fuente`, `id_categoria`, `id_tiempo`, `precio_usd`).

Según `docs/Reporte_Entregable5.md:212`: **168 filas, snapshot fijo del 2026-06-30**, cargado manualmente para el Entregable 5. No hay ningún proceso corriendo hoy que actualice estas tablas.

El comentario en `schema.prisma:172-179` dice que estas tablas "se cargaron en el E4 desde `backend/pipeline/scripts/dw/`" — **ese directorio no existe en el repo actual** (verificado, `backend/pipeline/` no existe). Es documentación de una arquitectura previa (probablemente Python) que quedó desalineada tras el refactor a NestJS nativo (commit `3bf78af`).

---

## Deuda y ruido encontrado

1. **`docs/database.md` está desactualizado.** Solo documenta `DomainRule`/`Product`/`PriceHistory`, no menciona `User`, `EtlRun`/`EtlProduct`/`QualityMetric` ni el schema `dw`. Además dice "separación del esquema en múltiples archivos" cuando el propio `schema.prisma:1-5` advierte que ese intento se revirtió porque nunca quedó conectado al generador y producía drift.
2. **Redundancia conceptual `Product` vs `EtlProduct`.** Dos modelos de "producto scrapeado" sin relación entre sí — uno alimentado por la extensión (`public.Product`), otro pensado para el pipeline ETL nativo (`public.EtlProduct`, hoy vacío). `openspec/changes/multi-scraper-menus/design.md:410` ya identificó esto y propone usar `EtlProduct` como tabla canónica para filtros por `source`/`category`, dejando `public.Product` con `rawData Json?` sin esos campos normalizados.
3. **Carpeta huérfana sin trackear:** `backend/backend/pipeline/raw/x/*.json` — path duplicado, indica un script de scraping corriendo con `cwd` mal resuelto. No es un problema de modelo de datos, pero ensucia el repo.

---

## Conclusión

El schema en sí no necesita rediseño de fondo. Lo que falta es **terminar de conectar el código al schema que ya existe**: implementar `dw-loader.service.ts` (T6.5, ya planeada), decidir el destino de `EtlProduct` vs `Product`, y actualizar `docs/database.md` para que refleje la realidad.

## Próximo paso decidido

El equipo optó por **separar físicamente la base operativa de la analítica** (dos bases de datos distintas en vez de dos schemas de Postgres en la misma base), y mover los scripts de carga hacia la base analítica. Ver seguimiento en próxima iteración de este documento o en un change SDD dedicado.
