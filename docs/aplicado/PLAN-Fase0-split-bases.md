# Plan Fase 0 — Split físico de bases de datos (operacional + analítica)

**Fecha:** 2026-07-10
**Estado:** ✅ COMPLETADO (5 de 5 pasos)
**Diseño de referencia:** `docs/DISENO-modelo-datos-2db.md`
**Decisión tomada:** dos contenedores Postgres separados (no dos databases en una
instancia). Confirmado con el usuario.

---

## Contexto técnico verificado

- Hoy: **un** Postgres (`scraper-postgres`, db `scraperdb`) con schemas `public` +
  `dw` adentro. Un solo `@prisma/client` vía `DATABASE_URL`, usado por `backend`
  y por `worker`. Prisma 7.8 con adapter `PrismaPg`.
- **Las tablas `dw` NO están en el historial de migraciones de Prisma** — se
  crearon a mano en el E4 (SQL manual). Las 8 migraciones existentes son todas
  del schema `public`. Esto simplifica: el lado operacional ya es "solo public".
- Mecánica Prisma 7 confirmada contra la doc oficial: dos schema files, cada uno
  con su `generator` (output propio) + `datasource`, generados por separado con
  `prisma generate --schema <path>`.
- `.env` y `.env.example` están protegidos por permisos — el usuario debe editar
  las variables de entorno a mano.

---

## Pasos

### ✅ Paso 1 — Contenedor DW (HECHO)

- Agregado `scraper-postgres-dw` a `docker-compose.yml`: imagen
  `postgres:16-alpine`, volumen propio `postgres_dw_data`, healthcheck, red
  `scraper-network`, puerto host `${POSTGRES_DW_PORT:-5434}` → 5432.
- `backend` ahora `depends_on` ambos Postgres (`service_healthy`).
- Variables nuevas (con defaults salvo el password): `POSTGRES_DW_USER`
  (def `scraper`), `POSTGRES_DW_PASSWORD` (**sin default, obligatoria**),
  `POSTGRES_DW_DB` (def `scraperdw`), `POSTGRES_DW_PORT` (def `5434`).
- Verificado: contenedor levanta `healthy` y acepta conexiones.

> **Pendiente del usuario:** agregar `POSTGRES_DW_PASSWORD` a `.env` (y
> `ANALYTICS_DATABASE_URL`, ver paso 2). Se levantó con una pass inline de prueba
> solo para verificar.

### ✅ Paso 2 — Variables de entorno (HECHO)

Agregadas a `.env` y `.env.example`: `POSTGRES_DW_USER`, `POSTGRES_DW_PASSWORD`,
`POSTGRES_DW_DB`, `POSTGRES_DW_PORT`, `ANALYTICS_DATABASE_URL`.

### ✅ Paso 3 — Split del schema Prisma (HECHO)

- `backend/prisma/operational/schema.prisma` — models `public`
  (DomainRule, Product, PriceHistory, User, EtlRun, EtlProduct, QualityMetric).
  `generator client` → `output = "../../src/generated/operational"`.
- `backend/prisma/analytics/schema.prisma` — star schema (7 dims + 2 facts).
  `generator client` → `output = "../../src/generated/analytics"`.
- Migraciones movidas a `backend/prisma/operational/migrations/`.
- Schema unificado `prisma/schema.prisma` y `prisma.config.ts` únicos borrados.
- Creados `prisma.operational.config.ts` + `prisma.analytics.config.ts`.
- Ambos clientes generados y verificados.

### ✅ Paso 4 — Dos PrismaService (HECHO)

- `OperationalPrismaService` en `common/prisma/operational-prisma.service.ts` —
  importa `PrismaClient` de `generated/operational`, usa `DATABASE_URL`.
- `AnalyticsPrismaService` en `common/prisma/analytics-prisma.service.ts` —
  importa `PrismaClient` de `generated/analytics`, usa `ANALYTICS_DATABASE_URL`.
- `PrismaModule` provee y exporta ambos.
- `PrismaService` original (importaba de `@prisma/client`) eliminado.
- Consumidores actualizados: UsersService, ProductsService, DomainsService usan
  `OperationalPrismaService`. Prisma namespace importado de `generated/operational`.
- Worker (`worker/`) sigue con su propio `PrismaClient` directo — solo operacional,
  no necesita split.

### ✅ Paso 5 — Migraciones + verificación (HECHO)

- Operacional: aplicadas las 8 migraciones existentes contra `scraperdb`.
  - Hubo que resolver migración fallida `20260616220000_add_visual_mapper_fields`
    (columna `fieldMappings` ya existía). Se marcó `--rolled-back` y luego
    `--applied`. Fue un one-time fix del estado dev.
- Analítica: baseline del star schema en `scraperdw` via `prisma db push`.
- Dockerfile.backend actualizado:
  - Incluye `packages/contracts/` en installer y builder (workspace dep).
  - Build contracts antes que backend.
  - Prisma generate en builder (para type-check) + deploy + runner generate
    contra deployed flat node_modules.
  - CMD usa `npx prisma` en vez de `pnpm exec` (evita corepack permission errors).
  - Copia `src/generated/` a `dist/generated/` en runner stage.
- `@prisma/client-runtime-utils@^7.8.0` agregado como dependencia explícita
  en `backend/package.json` (pnpm deploy no lo hoistaba como transitive dep).
- Variables DATABASE_URL overrideadas en compose para networking Docker
  (`postgres:5432` en vez de `localhost:5433`).
- Backend corre en Docker sin crash-loop, 84 tests pass en local.

---

## Riesgos / recordatorios

- ⚠️ **Puerto 3000 en conflicto**: el proyecto `sistema-incidencias-georreferenciadas`
  ocupa `:3000` y `:3001`. El backend del scraper se despliega en `:3002`. Si ese
  proyecto se detiene, volver a `BACKEND_PORT=3000`.
- ⚠️ **Fixes de build persistentes**: `packages/contracts/package.json` (postbuild
  escribe `dist-cjs/package.json` con `{"type":"commonjs"}`) y
  `backend/tsconfig.build.json` (excluye `scripts/**`) están actualmente aplicados.
  Si se pierden por un checkout, re-aplicar.
- ✅ **Fase 0 completada** — scaffolding del split físico. No incluye rediseño de
  modelos (Product↔Offer, RawCapture, Category/Brand). Eso es Fase 1.
- Nada de esto commiteado todavía.
