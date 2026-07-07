# Propuesta de Integración: Data Warehouse en NestJS + Prisma

**Proyecto:** Web Scraping Dinámico Automático — Módulo de Analítica
**Contexto:** Entregable 4 — Data Warehouse y Analítica · Inteligencia de Negocios · UPSE
**Autor:** Yandris Miguel Rivera Torres
**Fecha:** 7 de julio de 2026
**Estado:** Propuesta técnica para implementación

---

## Tabla de Contenidos

1. [Situación Actual](#1-situación-actual)
2. [Objetivo](#2-objetivo)
3. [Arquitectura Propuesta](#3-arquitectura-propuesta)
4. [Opción Recomendada: Prisma Multi-Schema + Raw SQL Híbrido](#4-opción-recomendada)
5. [Plan de Implementación](#5-plan-de-implementación)
6. [Impacto en el Código Existente](#6-impacto-en-el-código-existente)
7. [Migración y Riesgos](#7-migración-y-riesgos)
8. [Conclusión](#8-conclusión)

---

## 1. Situación Actual

### 1.1 Stack Operacional (Transactional)

El backend NestJS actual gestiona datos operacionales con el siguiente stack:

```
┌─────────────────────────────────────────────────────────────┐
│  NestJS 11 Backend                                          │
│  ├── PrismaModule (Global)                                  │
│  │   └── PrismaService extends PrismaClient                 │
│  │       └── adapter: PrismaPg                              │
│  ├── AuthModule        → public."User"                      │
│  ├── DomainsModule     → public."DomainRule"                │
│  └── ProductsModule    → public."Product", PriceHistory     │
├─────────────────────────────────────────────────────────────┤
│  Prisma Schema: prisma/schema.prisma                        │
│  Migraciones:  prisma/migrations/                           │
│  Conexión:  postgresql://scraper:scraperpass@localhost:5433 │
│            /scraperdb                                       │
└─────────────────────────────────────────────────────────────┘
```

- **Prisma 7.8.0** con adapter `@prisma/adapter-pg`
- Todos los modelos operacionales viven en el esquema `public` de PostgreSQL
- PrismaService es un Provider Global (`@Global()` en PrismaModule)

### 1.2 Data Warehouse (Analítico — Propuesto en E4)

El Data Warehouse diseñado para el E4 introduce un nuevo esquema `dw` con:

| Tabla | Esquema | Propósito |
|-------|---------|-----------|
| `dim_producto` | `dw` | Catálogo de productos |
| `dim_fuente` | `dw` | Plataformas de origen |
| `dim_categoria` | `dw` | Clasificación de productos |
| `dim_tiempo` | `dw` | Calendario analítico |
| `dim_moneda` | `dw` | Tipos de moneda |
| `dim_calificacion` | `dw` | Escala de calificación |
| `dim_genero` | `dw` | Género de encuestados |
| `fact_productos` | `dw` | Hechos de productos (tabla central) |
| `fact_encuesta_consumo` | `dw` | Hechos de encuesta |
| `mv_resumen_precios` | `dw` | Vista materializada analítica |
| `v_kpi_*` (5 vistas) | `dw` | KPIs como vistas lógicas |

**Problema:** Hoy las tablas del DW existen solo como scripts SQL sueltos (`pipeline/scripts/dw/dw_schema.sql`). No están integradas al ecosistema NestJS/Prisma, lo que significa:

- ❌ Sin tipos TypeScript generados para DW
- ❌ Sin migraciones versionadas para DW
- ❌ Sin endpoints REST para consultas analíticas
- ❌ Sin validación de esquema contra el código

---

## 2. Objetivo

Integrar el Data Warehouse al backend NestJS existente para que:

- Los modelos del DW tengan **tipos TypeScript generados** por Prisma
- El esquema `dw` esté **versionado en migraciones** junto con los modelos operacionales
- Existan **endpoints REST** en `/api/analytics` para consumir KPIs y consultas analíticas
- El pipeline de carga ETL (staging → DW) sea **invocable desde NestJS** mediante un comando o schedule
- Se mantenga una **separación clara** entre datos operacionales (públicos) y analíticos (solo lectura)

---

## 3. Arquitectura Propuesta

```
┌────────────────────────────────────────────────────────────────────┐
│                        NestJS 11 Backend                           │
│                                                                    │
│  ┌─ PrismaModule (Global) ──────────────────────────────────────┐  │
│  │  PrismaService extends PrismaClient                          │  │
│  │  ├── public."User" | DomainRule | Product | PriceHistory ... │  │
│  │  └── dw."DimProducto" | FactProductos | FactEncuesta ...     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─ AnalyticsModule ─────────────────────────────────────────────┐ │
│  │  ├── AnalyticsController  →  GET /api/analytics/kpis         │ │
│  │  │                          GET /api/analytics/kpis/:name    │ │
│  │  │                          GET /api/analytics/queries/:id   │ │
│  │  │                          POST /api/analytics/refresh-mv   │ │
│  │  │                          POST /api/analytics/load         │ │
│  │  │                          GET /api/analytics/summary       │ │
│  │  │                                                           │ │
│  │  ├── AnalyticsService        → Lógica de KPIs y consultas    │ │
│  │  ├── AnalyticsQueryService   → Raw SQL para consultas        │ │
│  │  │                            analíticas complejas            │ │
│  │  ├── DwLoaderService         → Carga ETL (staging → DW)      │ │
│  │  └── dto/                    → Tipos de entrada/salida       │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ┌─ TasksModule (NestJS Schedule) ──────────────────────────────┐ │
│  │  ├── ScheduleRefresMvTask  → REFRESH MATERIALIZED VIEW       │ │
│  │  └── ScheduleDwLoadTask    → Carga periódica staging → DW    │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────┐    ┌──────────────────────────┐
│  PostgreSQL 16   │    │  /pipeline/staging/      │
│  ┌─ public       │    │  ├── all_products_clean   │
│  │  (operational)│    │  ├── stg_encuesta_clean   │
│  ├─ dw           │    │  └── quality_report.json  │
│  │  (analítico)  │    └──────────────────────────┘
│  └─             │               │
└──────────────────┘               │ (carga ETL)
         ▲                         ▼
         │              ┌──────────────────────┐
         └──────────────│  pipeline/scripts/dw │
                        │  dw_load_staging.ts  │
                        └──────────────────────┘
```

### 3.1 Separación de Esquemas

| Esquema | Responsabilidad | Ciclo de Vida | Acceso |
|---------|----------------|---------------|--------|
| `public` | Datos operacionales CRUD (Productos, Reglas, Usuarios) | Mutaciones frecuentes (insert/update/delete) | Autenticado con JWT |
| `dw` | Datos analíticos (Hechos, Dimensiones, KPIs) | Solo lectura desde API; carga batch desde staging | Lectura pública (API Key) / interno |

### 3.2 Distribución de Responsabilidades

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| **DDL + Migraciones** | Prisma Migrate (`prisma/schema.prisma` + `prisma/migrations/`) | Versionar el esquema del DW junto al operacional |
| **Modelos Tipados** | Prisma Client (`@prisma/client`) | Tipos TypeScript generados automáticamente |
| **Consultas Simples (dimensiones)** | Prisma ORM (`this.prisma.dimProducto.findMany()`) | Queries planas con tipos seguros |
| **Consultas Analíticas Complejas** | Raw SQL (`this.prisma.$queryRawUnsafe()`) | Window functions, percentiles, KPIs |
| **Carga ETL** | TypeScript + Prisma + JSON | Leer staging, poblar DW |
| **Endpoints REST** | NestJS Controllers | Exponer KPIs, consultas y carga |
| **Vistas Materializadas** | PostgreSQL + Cron | Refrescar `mv_resumen_precios` periódicamente |

---

## 4. Opción Recomendada: Prisma Multi-Schema + Raw SQL Híbrido

### 4.1 Estrategia

Después de evaluar 4 alternativas (ver Apéndice A), esta es la opción recomendada porque:

**Prisma 7.8.0** soporta el atributo `@@schema("dw")` que permite mapear modelos a esquemas PostgreSQL específicos **dentro del mismo PrismaClient**. Esto significa:

- Un solo `PrismaClient` maneja `public` y `dw` — sin conexiones extra
- Los modelos del DW reciben tipos TypeScript completos
- Las migraciones de Prisma incluyen ambos esquemas
- Las consultas analíticas complejas (window functions, percentiles, KPIs) se ejecutan con `$queryRawUnsafe` para total control SQL

### 4.2 Cambios en Prisma Schema

Se añaden los modelos del DW al final del archivo `prisma/schema.prisma` existente:

```prisma
// ─── Esquema operacional (public — existente) ─────────────────
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearchPostgres"]
}

datasource db {
  provider = "postgresql"
}

model DomainRule { /* ... existente ... */ }
model Product { /* ... existente ... */ }
model PriceHistory { /* ... existente ... */ }
model User { /* ... existente ... */ }
model EtlRun { /* ... existente ... */ }
model EtlProduct { /* ... existente ... */ }
model QualityMetric { /* ... existente ... */ }

// ─── Esquema analítico (dw — NUEVO) ──────────────────────────
// Estos modelos viven en el esquema "dw" de PostgreSQL.
// Se acceden con el mismo PrismaClient.
// @@schema("dw") los mapea al esquema correcto.

model DimProducto {
  id_producto   Int     @id @default(autoincrement()) @map("id_producto")
  titulo_oferta String  @db.VarChar(500)
  url_producto  String? @db.Text
  disponibilidad String? @db.VarChar(20)

  factProductos FactProducto[]

  @@map("dim_producto")
  @@schema("dw")
}

model DimFuente {
  id_fuente     Int     @id @default(autoincrement()) @map("id_fuente")
  nombre_fuente String  @unique @db.VarChar(50)
  tipo_fuente   String? @db.VarChar(30)
  descripcion   String? @db.VarChar(200)

  factProductos       FactProducto[]
  factEncuestaConsumo FactEncuestaConsumo[]

  @@map("dim_fuente")
  @@schema("dw")
}

model DimCategoria {
  id_categoria     Int     @id @default(autoincrement()) @map("id_categoria")
  nombre_categoria String  @unique @db.VarChar(50)
  descripcion      String? @db.VarChar(200)

  factProductos FactProducto[]

  @@map("dim_categoria")
  @@schema("dw")
}

model DimTiempo {
  id_tiempo      Int     @id @default(autoincrement()) @map("id_tiempo")
  fecha_completa DateTime @unique @db.Date
  anio           Int
  mes            Int
  dia            Int
  trimestre      Int
  nombre_mes     String  @db.VarChar(20)

  factProductos FactProducto[]

  @@map("dim_tiempo")
  @@schema("dw")
}

model DimMoneda {
  id_moneda     Int    @id @default(autoincrement()) @map("id_moneda")
  codigo_moneda String @unique @db.Char(3)
  nombre_moneda String? @db.VarChar(50)
  simbolo       String? @db.VarChar(5)

  factProductos FactProducto[]

  @@map("dim_moneda")
  @@schema("dw")
}

model DimCalificacion {
  id_calificacion Int    @id @default(autoincrement()) @map("id_calificacion")
  nivel           String @unique @db.VarChar(10)
  valor_numerico  Int

  factProductos FactProducto[]

  @@map("dim_calificacion")
  @@schema("dw")
}

model DimGenero {
  id_genero    Int    @id @default(autoincrement()) @map("id_genero")
  nombre_genero String @unique @db.VarChar(20)
  abreviatura  String? @db.Char(1)

  factEncuestaConsumo FactEncuestaConsumo[]

  @@map("dim_genero")
  @@schema("dw")
}

model FactProducto {
  id_hecho       Int     @id @default(autoincrement()) @map("id_hecho")
  id_producto    Int     @map("id_producto")
  id_fuente      Int     @map("id_fuente")
  id_categoria   Int     @map("id_categoria")
  id_tiempo      Int     @map("id_tiempo")
  id_moneda      Int     @map("id_moneda")
  id_calificacion Int?   @map("id_calificacion")
  precio_usd     Decimal? @db.Decimal(12, 2)
  precio_raw     String? @db.VarChar(50)
  disponibilidad String? @db.VarChar(20)

  producto      DimProducto      @relation(fields: [id_producto], references: [id_producto])
  fuente        DimFuente        @relation(fields: [id_fuente], references: [id_fuente])
  categoria     DimCategoria     @relation(fields: [id_categoria], references: [id_categoria])
  tiempo        DimTiempo        @relation(fields: [id_tiempo], references: [id_tiempo])
  moneda        DimMoneda        @relation(fields: [id_moneda], references: [id_moneda])
  calificacion  DimCalificacion? @relation(fields: [id_calificacion], references: [id_calificacion])

  @@index([id_fuente])
  @@index([id_categoria])
  @@index([id_tiempo])
  @@index([precio_usd])
  @@map("fact_productos")
  @@schema("dw")
}

model FactEncuestaConsumo {
  id_hecho               Int     @id @default(autoincrement()) @map("id_hecho")
  id_genero              Int     @map("id_genero")
  id_sitio_preferido     Int     @map("id_sitio_preferido")
  edad                   Int?
  frecuencia_compra      String? @db.VarChar(20)
  gasto_promedio_mensual String? @db.VarChar(20)
  motivo_compra          String? @db.VarChar(200)

  genero       DimGenero @relation(fields: [id_genero], references: [id_genero])
  sitioPref    DimFuente @relation(fields: [id_sitio_preferido], references: [id_fuente])

  @@index([id_genero])
  @@index([id_sitio_preferido])
  @@map("fact_encuesta_consumo")
  @@schema("dw")
}
```

**Comportamiento de Prisma con `@@schema("dw")`:**
- `prisma generate` genera tipos `DimProducto`, `FactProducto`, etc. con TypeScript completo
- `prisma migrate` detecta el esquema `dw` y aplica migraciones allí
- `prisma db push` funciona contra ambos esquemas
- En tiempo de ejecución, el mismo `PrismaClient` hace `SET search_path` internamente

### 4.3 Nueva Estructura de Archivos

```
backend/
├── prisma/
│   ├── schema.prisma          ← Se añaden modelos DW al final
│   └── migrations/            ← Prisma versiona ambos esquemas juntos
├── src/
│   ├── common/
│   │   └── prisma/
│   │       ├── prisma.module.ts   ← Sin cambios (sigue siendo Global)
│   │       ├── prisma.service.ts  ← Sin cambios (misma conexión)
│   │       └── index.ts
│   ├── modules/
│   │   ├── auth/              ← Sin cambios
│   │   ├── domains/           ← Sin cambios
│   │   ├── products/          ← Sin cambios
│   │   └── analytics/         ← NUEVO
│   │       ├── dto/
│   │       │   ├── kpi-response.dto.ts
│   │       │   ├── analytical-query.dto.ts
│   │       │   └── load-dw.dto.ts
│   │       ├── analytics.module.ts
│   │       ├── analytics.controller.ts
│   │       ├── analytics.service.ts
│   │       ├── analytics-query.service.ts   ← Raw SQL complejo
│   │       ├── analytics-query.service.spec.ts
│   │       ├── dw-loader.service.ts
│   │       ├── dw-loader.service.spec.ts
│   │       └── index.ts
│   └── tasks/                 ← NUEVO (opcional)
│       ├── tasks.module.ts
│       ├── refresh-mv.task.ts
│       └── dw-load.task.ts
└── test/
    └── analytics.e2e-spec.ts  ← NUEVO
```

### 4.4 Implementación del AnalyticsModule

#### `analytics.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryService } from './analytics-query.service';
import { DwLoaderService } from './dw-loader.service';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    AnalyticsQueryService,
    DwLoaderService,
  ],
  exports: [AnalyticsService, AnalyticsQueryService],
})
export class AnalyticsModule {}
```

#### `analytics.controller.ts`

```typescript
import {
  Controller, Get, Post, Param, Query, Body, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryService } from './analytics-query.service';
import { DwLoaderService } from './dw-loader.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('api/analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private readonly analytics: AnalyticsService,
    private readonly queries: AnalyticsQueryService,
    private readonly loader: DwLoaderService,
  ) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Obtener todos los KPIs del DW' })
  async getAllKpis() {
    return this.analytics.getAllKpis();
  }

  @Get('kpis/:name')
  @ApiOperation({ summary: 'Obtener un KPI específico por nombre' })
  async getKpi(@Param('name') name: string) {
    return this.analytics.getKpi(name);
  }

  @Get('queries/main')
  @ApiOperation({ summary: 'Distribución de precios por fuente y categoría (pregunta principal)' })
  async getMainQuery() {
    return this.queries.runPreguntaPrincipal();
  }

  @Get('queries/ranked-products')
  @ApiOperation({ summary: 'Productos más económicos y costosos por fuente (RANK)' })
  async getRankedProducts() {
    return this.queries.runRankedProducts();
  }

  @Get('queries/category-distribution')
  @ApiOperation({ summary: 'Distribución de categorías con DENSE_RANK' })
  async getCategoryDistribution() {
    return this.queries.runCategoryDistribution();
  }

  @Get('queries/percentiles')
  @ApiOperation({ summary: 'Percentiles de precios por fuente' })
  async getPercentiles() {
    return this.queries.runPercentileAnalysis();
  }

  @Get('queries/outliers')
  @ApiOperation({ summary: 'Detección de outliers (IQR)' })
  async getOutliers() {
    return this.queries.runOutlierDetection();
  }

  @Get('queries/encuesta')
  @ApiOperation({ summary: 'Análisis de encuesta: frecuencia, género, sitio' })
  async getEncuestaAnalysis() {
    return this.queries.runEncuestaAnalysis();
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumen general del DW' })
  async getSummary() {
    return this.queries.runDwSummary();
  }

  @Post('refresh-mv')
  @ApiOperation({ summary: 'Refrescar vista materializada' })
  async refreshMaterializedView() {
    await this.queries.refreshMaterializedView();
    return { message: 'Vista materializada refrescada' };
  }

  @Post('load')
  @ApiOperation({ summary: 'Ejecutar carga ETL desde staging al DW' })
  async loadDw() {
    const result = await this.loader.run();
    return result;
  }
}
```

#### `analytics-query.service.ts` (Raw SQL para consultas complejas)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AnalyticsQueryService {
  private readonly logger = new Logger(AnalyticsQueryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pregunta Principal: Distribución de precios por fuente y categoría
   */
  async runPreguntaPrincipal() {
    const sql = `
      SELECT
        df.nombre_fuente          AS fuente,
        dc.nombre_categoria       AS categoria,
        COUNT(fp.id_hecho)        AS total_productos,
        ROUND(AVG(fp.precio_usd), 2) AS precio_promedio_usd,
        ROUND(MIN(fp.precio_usd), 2)  AS precio_minimo_usd,
        ROUND(MAX(fp.precio_usd), 2)  AS precio_maximo_usd,
        ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fp.precio_usd), 2) AS mediana_precio_usd,
        ROUND(STDDEV(fp.precio_usd), 2) AS desviacion_estandar
      FROM dw.fact_productos fp
      JOIN dw.dim_fuente df       ON fp.id_fuente = df.id_fuente
      JOIN dw.dim_categoria dc    ON fp.id_categoria = dc.id_categoria
      JOIN dw.dim_tiempo dt       ON fp.id_tiempo = dt.id_tiempo
      WHERE fp.precio_usd IS NOT NULL
      GROUP BY df.nombre_fuente, dc.nombre_categoria
      ORDER BY precio_promedio_usd DESC
    `;
    return this.prisma.$queryRawUnsafe(sql);
  }

  /**
   * Productos más económicos y costosos por fuente con RANK
   */
  async runRankedProducts() {
    const sql = `
      WITH ranked AS (
        SELECT
          df.nombre_fuente AS fuente, dp.titulo_oferta AS producto,
          fp.precio_usd,
          RANK() OVER (PARTITION BY df.nombre_fuente ORDER BY fp.precio_usd ASC NULLS LAST) AS rank_asc,
          RANK() OVER (PARTITION BY df.nombre_fuente ORDER BY fp.precio_usd DESC NULLS LAST) AS rank_desc
        FROM dw.fact_productos fp
        JOIN dw.dim_producto dp ON fp.id_producto = dp.id_producto
        JOIN dw.dim_fuente df   ON fp.id_fuente = df.id_fuente
        WHERE fp.precio_usd IS NOT NULL
      )
      SELECT fuente, producto, precio_usd, 'MÁS ECONÓMICO' AS tipo
      FROM ranked WHERE rank_asc = 1
      UNION ALL
      SELECT fuente, producto, precio_usd, 'MÁS COSTOSO' AS tipo
      FROM ranked WHERE rank_desc = 1
      ORDER BY fuente, tipo DESC
    `;
    return this.prisma.$queryRawUnsafe(sql);
  }

  /**
   * Distribución de categorías con DENSE_RANK
   */
  async runCategoryDistribution() {
    const sql = `
      SELECT
        dc.nombre_categoria       AS categoria,
        COUNT(fp.id_hecho)        AS total_productos,
        ROUND(COUNT(fp.id_hecho) * 100.0 / SUM(COUNT(fp.id_hecho)) OVER(), 1) AS pct_del_total,
        ROUND(AVG(fp.precio_usd), 2) AS precio_promedio,
        DENSE_RANK() OVER (ORDER BY COUNT(fp.id_hecho) DESC) AS rank_frecuencia
      FROM dw.fact_productos fp
      JOIN dw.dim_categoria dc ON fp.id_categoria = dc.id_categoria
      GROUP BY dc.nombre_categoria
      ORDER BY total_productos DESC
    `;
    return this.prisma.$queryRawUnsafe(sql);
  }

  /**
   * Análisis de percentiles por fuente
   */
  async runPercentileAnalysis() {
    const sql = `
      SELECT
        df.nombre_fuente AS fuente,
        COUNT(fp.precio_usd) AS total_con_precio,
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY fp.precio_usd), 2) AS p25,
        ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY fp.precio_usd), 2) AS mediana,
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY fp.precio_usd), 2) AS p75,
        ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY fp.precio_usd), 2) AS p90,
        ROUND(AVG(fp.precio_usd), 2) AS media,
        ROUND(STDDEV(fp.precio_usd), 2) AS desviacion
      FROM dw.fact_productos fp
      JOIN dw.dim_fuente df ON fp.id_fuente = df.id_fuente
      WHERE fp.precio_usd IS NOT NULL
      GROUP BY df.nombre_fuente
      ORDER BY media DESC
    `;
    return this.prisma.$queryRawUnsafe(sql);
  }

  /**
   * Detección de outliers con IQR
   */
  async runOutlierDetection() {
    const sql = `
      WITH stats AS (
        SELECT
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY precio_usd) AS q1,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY precio_usd) AS q3
        FROM dw.fact_productos WHERE precio_usd IS NOT NULL
      )
      SELECT
        dp.titulo_oferta AS producto, df.nombre_fuente AS fuente, fp.precio_usd,
        CASE
          WHEN fp.precio_usd < (SELECT q1 - 1.5 * (q3 - q1) FROM stats) THEN 'OUTLIER_INFERIOR'
          WHEN fp.precio_usd > (SELECT q3 + 1.5 * (q3 - q1) FROM stats) THEN 'OUTLIER_SUPERIOR'
          ELSE 'NORMAL'
        END AS clasificacion
      FROM dw.fact_productos fp
      JOIN dw.dim_producto dp ON fp.id_producto = dp.id_producto
      JOIN dw.dim_fuente df   ON fp.id_fuente = df.id_fuente
      WHERE fp.precio_usd IS NOT NULL
      ORDER BY fp.precio_usd DESC
    `;
    return this.prisma.$queryRawUnsafe(sql);
  }

  /**
   * Análisis de encuesta
   */
  async runEncuestaAnalysis() {
    const sql = `
      SELECT
        dg.nombre_genero AS genero,
        df.nombre_fuente AS sitio_preferido,
        COUNT(fec.id_hecho) AS total,
        fec.frecuencia_compra AS frecuencia,
        fec.gasto_promedio_mensual AS gasto
      FROM dw.fact_encuesta_consumo fec
      JOIN dw.dim_genero dg  ON fec.id_genero = dg.id_genero
      JOIN dw.dim_fuente df  ON fec.id_sitio_preferido = df.id_fuente
      GROUP BY dg.nombre_genero, df.nombre_fuente, fec.frecuencia_compra, fec.gasto_promedio_mensual
      ORDER BY total DESC
    `;
    return this.prisma.$queryRawUnsafe(sql);
  }

  /**
   * Resumen general del DW (conteo de registros por tabla)
   */
  async runDwSummary() {
    const sql = `
      SELECT 'dim_producto' AS tabla, COUNT(*) AS registros FROM dw.dim_producto
      UNION ALL SELECT 'dim_fuente', COUNT(*) FROM dw.dim_fuente
      UNION ALL SELECT 'dim_categoria', COUNT(*) FROM dw.dim_categoria
      UNION ALL SELECT 'dim_tiempo', COUNT(*) FROM dw.dim_tiempo
      UNION ALL SELECT 'dim_moneda', COUNT(*) FROM dw.dim_moneda
      UNION ALL SELECT 'dim_calificacion', COUNT(*) FROM dw.dim_calificacion
      UNION ALL SELECT 'dim_genero', COUNT(*) FROM dw.dim_genero
      UNION ALL SELECT 'fact_productos', COUNT(*) FROM dw.fact_productos
      UNION ALL SELECT 'fact_encuesta_consumo', COUNT(*) FROM dw.fact_encuesta_consumo
      ORDER BY tabla
    `;
    return this.prisma.$queryRawUnsafe(sql);
  }

  /**
   * Refrescar vista materializada
   */
  async refreshMaterializedView() {
    await this.prisma.$executeRawUnsafe(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY dw.mv_resumen_precios',
    );
    this.logger.log('Vista materializada refrescada');
  }
}
```

#### `analytics.service.ts` (KPIs con Prisma ORM)

```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtener todos los KPIs ejecutando las vistas del DW
   */
  async getAllKpis() {
    const [precioCategoria, distribucionFuentes, completitud, rangoPrecios, preferencia] =
      await Promise.all([
        this.prisma.$queryRawUnsafe('SELECT * FROM dw.v_kpi_precio_promedio_categoria'),
        this.prisma.$queryRawUnsafe('SELECT * FROM dw.v_kpi_distribucion_fuentes'),
        this.prisma.$queryRawUnsafe('SELECT * FROM dw.v_kpi_completitud_datos'),
        this.prisma.$queryRawUnsafe('SELECT * FROM dw.v_kpi_rango_precios_fuente'),
        this.prisma.$queryRawUnsafe('SELECT * FROM dw.v_kpi_preferencia_plataformas'),
      ]);

    return {
      precio_por_categoria: precioCategoria,
      distribucion_fuentes: distribucionFuentes,
      completitud_datos: completitud,
      rango_precios_fuente: rangoPrecios,
      preferencia_plataformas: preferencia,
    };
  }

  /**
   * Obtener un KPI específico por nombre
   */
  async getKpi(name: string) {
    const viewMap: Record<string, string> = {
      'precio-categoria': 'dw.v_kpi_precio_promedio_categoria',
      'distribucion-fuentes': 'dw.v_kpi_distribucion_fuentes',
      'completitud': 'dw.v_kpi_completitud_datos',
      'rango-precios': 'dw.v_kpi_rango_precios_fuente',
      'preferencia': 'dw.v_kpi_preferencia_plataformas',
    };

    const view = viewMap[name];
    if (!view) throw new NotFoundException(`KPI "${name}" no encontrado`);

    return this.prisma.$queryRawUnsafe(`SELECT * FROM ${view}`);
  }
}
```

#### `dw-loader.service.ts` (Carga ETL desde staging)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DwLoaderService {
  private readonly logger = new Logger(DwLoaderService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run() {
    this.logger.log('Iniciando carga ETL: Staging → Data Warehouse');
    const stagingDir = path.join(process.cwd(), '..', 'pipeline', 'staging');

    if (!fs.existsSync(stagingDir)) {
      return { error: `Directorio staging no encontrado: ${stagingDir}` };
    }

    try {
      // 1. Cargar dimensiones de referencia
      await this.ensureDimensions();

      // 2. Cargar fact_productos desde all_products_clean.json
      const prodPath = path.join(stagingDir, 'all_products_clean.json');
      const productos = JSON.parse(fs.readFileSync(prodPath, 'utf-8'));
      const prodResult = await this.loadFactProductos(productos);

      // 3. Cargar fact_encuesta_consumo desde stg_encuesta_clean.json
      const encPath = path.join(stagingDir, 'stg_encuesta_clean.json');
      const encuestas = JSON.parse(fs.readFileSync(encPath, 'utf-8'));
      const encResult = await this.loadFactEncuesta(encuestas);

      return {
        productos_cargados: prodResult,
        encuestas_cargadas: encResult,
        estado: 'completado',
      };
    } catch (err: any) {
      this.logger.error(`Error en carga DW: ${err.message}`, err.stack);
      return { error: err.message, estado: 'fallido' };
    }
  }

  private async ensureDimensions() {
    // Lógica idéntica al script dw_load_staging.ts
    // pero usando PrismaService en lugar de PrismaClient directo
    // (ver implementación completa en el script original)
  }

  private async loadFactProductos(data: any[]): Promise<number> {
    let count = 0;
    for (const item of data) {
      if (!item.titulo_oferta) continue;
      try {
        // Usa $queryRawUnsafe para insertar con validación
        // de claves foráneas contra dimensiones existentes
        count++;
      } catch { /* skip duplicados */ }
    }
    return count;
  }

  private async loadFactEncuesta(data: any[]): Promise<number> {
    let count = 0;
    for (const item of data) {
      // Misma lógica que dw_load_staging.ts
      count++;
    }
    return count;
  }
}
```

### 4.5 Endpoints REST Expuestos

| Método | Endpoint | Descripción | Cache |
|--------|----------|-------------|-------|
| `GET` | `/api/analytics/kpis` | Todos los KPIs del DW | 5 min |
| `GET` | `/api/analytics/kpis/:name` | KPI específico | 5 min |
| `GET` | `/api/analytics/queries/main` | Pregunta principal (precios x fuente/categoría) | 5 min |
| `GET` | `/api/analytics/queries/ranked-products` | Top productos por fuente con RANK | 5 min |
| `GET` | `/api/analytics/queries/category-distribution` | Distribución de categorías (DENSE_RANK) | 5 min |
| `GET` | `/api/analytics/queries/percentiles` | Percentiles de precios | 5 min |
| `GET` | `/api/analytics/queries/outliers` | Detección de outliers (IQR) | 5 min |
| `GET` | `/api/analytics/queries/encuesta` | Análisis de encuesta | 5 min |
| `GET` | `/api/analytics/summary` | Resumen del DW (conteos) | 1 min |
| `POST` | `/api/analytics/refresh-mv` | Refrescar vista materializada | — |
| `POST` | `/api/analytics/load` | Carga ETL desde staging | — |

---

## 5. Plan de Implementación

### Fase 1: Integración de Esquema (Día 1)

| # | Tarea | Archivo | Comando |
|---|-------|---------|---------|
| 1 | Añadir modelos DW al schema de Prisma | `prisma/schema.prisma` | — |
| 2 | Crear migración inicial del DW | `prisma/migrations/` | `pnpm prisma:migrate --name add_dw_schema` |
| 3 | Generar cliente Prisma con tipos DW | — | `pnpm prisma:generate` |
| 4 | Verificar tipos generados | `node_modules/.prisma/client/index.d.ts` | — |

### Fase 2: Módulo Analytics (Día 2)

| # | Tarea | Archivos | Dependencia |
|---|-------|---------|-------------|
| 5 | Crear `AnalyticsModule` | `analytics/analytics.module.ts` | Fase 1 |
| 6 | Crear `AnalyticsController` con endpoints | `analytics/analytics.controller.ts` | Fase 1 |
| 7 | Crear `AnalyticsQueryService` (raw SQL) | `analytics/analytics-query.service.ts` | Fase 1 |
| 8 | Crear `AnalyticsService` (KPIs) | `analytics/analytics.service.ts` | Fase 1 |
| 9 | Registrar `AnalyticsModule` en `AppModule` | `app.module.ts` | #5 |
| 10 | Escribir tests unitarios | `*.spec.ts` | #7, #8 |

### Fase 3: Carga ETL Integrada (Día 3)

| # | Tarea | Archivos | Dependencia |
|---|-------|---------|-------------|
| 11 | Crear `DwLoaderService` | `analytics/dw-loader.service.ts` | Fase 1 |
| 12 | Integrar carga ETL como endpoint POST | `analytics.controller.ts` | #11 |
| 13 | Probar carga end-to-end | — | #12 |
| 14 | Escribir test e2e | `test/analytics.e2e-spec.ts` | #12 |

### Fase 4: Automatización (Día 4 — Opcional)

| # | Tarea | Archivos | Dependencia |
|---|-------|---------|-------------|
| 15 | Crear tarea schedule para refrescar MV | `tasks/refresh-mv.task.ts` | Fase 2 |
| 16 | Crear tarea schedule para carga ETL periódica | `tasks/dw-load.task.ts` | Fase 3 |
| 17 | Documentar en README | `README.md` | — |

---

## 6. Impacto en el Código Existente

### 6.1 Sin Impacto (Archivos No Modificados)

| Archivo | Razón |
|---------|-------|
| `prisma/prisma.config.ts` | La misma URL de conexión sirve para ambos esquemas |
| `src/common/prisma/prisma.module.ts` | Sigue siendo Global, no requiere cambios |
| `src/common/prisma/prisma.service.ts` | El mismo `PrismaClient` maneja `public` y `dw` |
| `src/modules/auth/` | No toca lógica de autenticación |
| `src/modules/domains/` | No toca lógica de dominios |
| `src/modules/products/` | No toca lógica de productos |

### 6.2 Cambios Mínimos

| Archivo | Cambio |
|---------|--------|
| `prisma/schema.prisma` | Se añaden ~100 líneas al final (modelos DW con `@@schema("dw")`) |
| `src/app.module.ts` | Se importa `AnalyticsModule` en `imports: []` |

### 6.3 Nuevos Archivos (Sin Modificar Existentes)

| Archivo | Líneas Estimadas |
|---------|:----------------:|
| `backend/src/modules/analytics/analytics.module.ts` | ~15 |
| `backend/src/modules/analytics/analytics.controller.ts` | ~120 |
| `backend/src/modules/analytics/analytics.service.ts` | ~60 |
| `backend/src/modules/analytics/analytics-query.service.ts` | ~200 |
| `backend/src/modules/analytics/dw-loader.service.ts` | ~250 |
| `backend/src/modules/analytics/dto/kpi-response.dto.ts` | ~30 |
| `backend/src/modules/analytics/dto/analytical-query.dto.ts` | ~20 |
| `backend/src/modules/analytics/dto/load-dw.dto.ts` | ~15 |
| `backend/src/modules/analytics/index.ts` | ~5 |
| `backend/src/modules/analytics/analytics-query.service.spec.ts` | ~80 |
| `backend/src/modules/analytics/dw-loader.service.spec.ts` | ~80 |
| `backend/test/analytics.e2e-spec.ts` | ~100 |
| **Total nuevos** | **~975 líneas** |

---

## 7. Migración y Riesgos

### 7.1 Plan de Migración

```bash
# 1. Asegurar que el esquema dw existe en PostgreSQL
psql -h localhost -p 5433 -U scraper -d scraperdb -c "CREATE SCHEMA IF NOT EXISTS dw;"

# 2. Aplicar el DDL base del DW (tablas, índices, vistas)
psql -h localhost -p 5433 -U scraper -d scraperdb -f pipeline/scripts/dw/dw_schema.sql

# 3. Cargar datos iniciales desde staging
cd pipeline && npx ts-node scripts/dw/dw_load_staging.ts

# 4. Crear vistas analíticas
psql -h localhost -p 5433 -U scraper -d scraperdb -f pipeline/scripts/dw/dw_analytical_queries.sql

# 5. Integrar modelos en Prisma (editar schema.prisma)
# 6. Generar cliente
pnpm prisma:generate

# 7. Marcar migración como aplicada (no crear nueva)
pnpm prisma migrate resolve --applied add_dw_schema

# 8. Verificar tipos y arrancar backend
pnpm start:dev
```

### 7.2 Riesgos Identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|:-----------:|:-------:|-----------|
| Prisma genera consultas ineficientes para el DW | Baja | Medio | Solo usar Prisma ORM para queries simples de dimensiones; usar `$queryRawUnsafe` para analíticas complejas |
| Migraciones de Prisma intentan dropear el esquema `dw` | Baja | Alto | Usar `prisma migrate resolve --applied` en lugar de `prisma migrate dev` para el primer deploy |
| `@@schema("dw")` no soportado en Prisma 7 | Muy baja | Alto | Verificar; si falla, usar `model Foo { @@map("dw.foo") }` — aunque esto es sintaxis no estándar. Alternativa real: raw SQL |
| La carga ETL desde NestJS duplica lógica del script CLI | Media | Bajo | Extraer la lógica común a una librería compartida o invocar el script CLI como child process |
| Conflictos de JWT (DW debería ser público) | Media | Medio | Marcar endpoints analíticos con `@Public()` si se requiere acceso sin autenticación |

### 7.3 Prerrequisitos

- [x] PostgreSQL 16 corriendo (Docker)
- [x] Esquema `dw` creado con tablas y datos cargados
- [x] Prisma 7.8.0 (ya instalado — compatible con `@@schema`)
- [ ] Verificar que `prisma generate` produce tipos para modelos con `@@schema("dw")`
- [ ] Verificar que `prisma migrate` reconoce el esquema `dw`

---

## 8. Conclusión

La integración del Data Warehouse en NestJS + Prisma es viable con **mínimo impacto** en el código existente:

1. **Sin cambios** en `PrismaService`, `PrismaModule` o los módulos operacionales
2. **Sin nuevas conexiones** a base de datos — el mismo `PrismaClient` maneja ambos esquemas
3. **Tipado completo** — Prisma genera tipos TypeScript para todas las tablas del DW
4. **Rendimiento analítico** — las consultas complejas usan Raw SQL directamente, evitando el overhead del ORM
5. **Carga ETL invocable** desde API REST, no solo desde CLI

El esfuerzo estimado es de **~4 días** para la implementación completa (Fases 1-3) y **+1 día** para automatización opcional (Fase 4).

---

## Apéndice A: Evaluación de Alternativas

### Alternativa 1: Solo Raw SQL (sin modelos Prisma para DW)

| Aspecto | Evaluación |
|---------|-----------|
| **Pros** | Sin cambios en schema.prisma; máximo control SQL |
| **Contras** | Sin tipos TypeScript para DW; sin autocompletado; los nombres de columna son strings |
| **Veredicto** | ❌ Descartado — perder tipado quita la principal ventaja de Prisma |

### Alternativa 2: 💡 **Prisma Multi-Schema + Raw SQL Híbrido (RECOMENDADO)**

| Aspecto | Evaluación |
|---------|-----------|
| **Pros** | Un solo cliente; tipos generados para DW; raw SQL para analíticas complejas; migraciones unificadas |
| **Contras** | Prerrequisito: verificar compatibilidad de `@@schema` en Prisma 7.8.0 |
| **Veredicto** | ✅ **RECOMENDADO** — mejor equilibrio entre tipado y flexibilidad |

### Alternativa 3: Cliente Prisma separado para DW

| Aspecto | Evaluación |
|---------|-----------|
| **Pros** | Separación total; se podría conectar a otra BD |
| **Contras** | Dos conexiones; dos generaciones; complejidad de setup innecesaria para el mismo PostgreSQL |
| **Veredicto** | ❌ Descartado — sobreingeniería para este caso de uso |

### Alternativa 4: Microservicio de Analítica separado

| Aspecto | Evaluación |
|---------|-----------|
| **Pros** | Aislamiento total; escalamiento independiente |
| **Contras** | Overhead masivo para un proyecto académico; dos deploys; dos codebases |
| **Veredicto** | ❌ Descartado — inapropiado para el alcance del proyecto |

---

## Apéndice B: Referencias

- [Prisma Docs: Multi-schema](https://www.prisma.io/docs/orm/prisma-schema/overview#multi-schema) — Soporte de `@@schema` para PostgreSQL
- [Prisma Docs: Raw SQL](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql) — `$queryRawUnsafe` y `$executeRawUnsafe`
- [NestJS Docs: Modules](https://docs.nestjs.com/modules) — Estructura de módulos
- [NestJS Docs: Scheduled Tasks](https://docs.nestjs.com/techniques/task-scheduling) — `@nestjs/schedule`
- `pipeline/scripts/dw/dw_schema.sql` — DDL del modelo estrella
- `pipeline/scripts/dw/dw_load_staging.ts` — Script de carga ETL original
- `pipeline/scripts/dw/dw_analytical_queries.sql` — Consultas analíticas y KPIs
- `docs/Entregable4_DataWarehouse_Analitica.md` — Documento completo del E4

---

*Documento generado como propuesta técnica para la integración del Data Warehouse en el ecosistema NestJS/Prisma del proyecto Web Scraping Dinámico Automático.*
