# Diseño de modelo de datos — Base operacional + Base analítica (desde cero)

**Fecha:** 2026-07-10
**Estado:** Propuesta de arquitectura de datos
**Relacionado:** `docs/REVIEW-2026-07-10-modelo-datos.md` (diagnóstico del estado actual)

---

## 1. Principio de separación

Dos bases de datos PostgreSQL **físicamente separadas** (dos instancias, dos
`DATABASE_URL`, dos schemas de Prisma, dos clientes generados). No hay JOINs
entre ellas: el único puente es el proceso ETL.

| | Base **OPERACIONAL** (OLTP) | Base **ANALÍTICA** (DW / OLAP) |
|---|---|---|
| Propósito | Correr la app día a día | Responder preguntas de negocio |
| Escritura | Constante (cada scrapeo, cada login) | Por lotes (ETL) |
| Forma de los datos | Crudos + normalizados operativos | Modelo estrella desnormalizado |
| Qué guarda | Lo desestructurado y lo transaccional | Solo lo agregable/consultable |
| Quién la consume | API operativa, extensión, app | API de dashboards, reportes |

Regla mental: **la operacional es la fuente de la verdad; la analítica es una
copia optimizada para leer.** Si se borra la analítica, se reconstruye entera
corriendo el ETL de nuevo. Nunca al revés.

---

## 2. Flujo de negocio (las 5 etapas)

```
┌─────────┐   ┌────────┐   ┌──────────┐   ┌────────┐   ┌────────┐
│ EXTRACT │──▶│  RAW   │──▶│  STAGE   │──▶│   DW   │──▶│ SERVE  │
│ scrapeo │   │ landing│   │ normaliz.│   │ estrella│  │ API    │
└─────────┘   └────────┘   └──────────┘   └────────┘   └────────┘
     │             │             │             │            │
 extensión    RawCapture    limpieza +    fact/dim     dashboards
 o headless   (JSONB        calidad(7)    (batch)      + app
              inmutable)
     └──────── BASE OPERACIONAL ──────────┘   └── BASE ANALÍTICA ──┘
```

1. **Extract** — dos modos de adquisición que ya existen en el proyecto:
   - *Asistido por extensión*: mapeo visual en la sesión real del usuario
     (esquiva antibot). Usa `DomainRule.fieldMappings`.
   - *Headless nativo*: Playwright para sitios sin antibot (MercadoLibre,
     AliExpress).
   Ambos producen un **payload crudo** con la forma propia de cada sitio:
   precios como texto (`"$1.299,00"`, `"US $12.34"`), campos faltantes, nombres
   de campo distintos por fuente.

2. **Raw (landing)** — se guarda el payload crudo **tal cual, inmutable**, en la
   operacional. Esta es tu "data desestructurada que no sirve para analítica":
   sirve para auditoría, para re-procesar si cambia la lógica de limpieza, y
   como evidencia de trazabilidad. Nunca se edita, solo se inserta.

3. **Stage (normalización)** — acá pasa la transformación **determinística** (NO
   red neuronal): parsear precio a `Decimal` + `currency`, mapear nombres de
   campo por fuente con un diccionario de alias, asignar `category`/`brand`,
   deduplicar. Corren los **7 controles de calidad** ya diseñados
   (`QualityService`). Lo que pasa calidad avanza; lo que no, se marca y no
   contamina el DW.

4. **DW (carga)** — se cargan las tablas del modelo estrella en la base
   analítica. Grano mínimo: una fila de hecho por (producto × fuente × fecha).

5. **Serve** — la API operativa sirve la app (listado de productos, historial de
   precio); la API analítica sirve dashboards (KPIs, agregaciones por categoría,
   series de tiempo).

---

## 3. Base OPERACIONAL — modelo propuesto

El error del modelo actual: `Product` aplasta **tres conceptos distintos** en una
tabla. Los separamos.

### 3.1 Entidades

```prisma
// ─── Configuración de scraping ──────────────────────────────
model Source {                 // catálogo de sitios que scrapeamos
  id          String   @id @default(uuid())
  slug        String   @unique  // "meli", "aliexpress", "temu"...
  displayName String              // "MercadoLibre"
  kind        String              // "marketplace" | "survey" | "file"
  domainRules DomainRule[]
  offers      Offer[]
  captures    RawCapture[]
}

model DomainRule {             // CÓMO extraer de un dominio (extensión)
  id                String  @id @default(uuid())
  sourceId          String
  domain            String  @unique   // "temu.com"
  fieldMappings     Json?              // selectores del mapeo visual
  containerSelector String?
  paginationType    String  @default("scroll")
  // ... (sin cambios respecto al actual)
}

// ─── Zona RAW (lo desestructurado) ──────────────────────────
model RawCapture {             // payload crudo, INMUTABLE
  id         String   @id @default(uuid())
  sourceId   String
  url        String
  payload    Json                // JSON tal cual salió del scrapeo
  capturedAt DateTime @default(now())
  status     String   @default("pending")  // pending|processed|failed
  @@index([sourceId, capturedAt])
}

// ─── Taxonomía (lo que hoy vive enterrado en rawData) ───────
model Category {
  id       String  @id @default(uuid())
  slug     String  @unique   // "pantalones", "electronica"
  name     String
  parentId String?           // jerarquía opcional (self-ref)
  parent   Category? @relation("Tree", fields: [parentId], references: [id])
}

model Brand {
  id   String @id @default(uuid())
  slug String @unique        // "levis", "nike"
  name String
}

// ─── Producto canónico + ofertas ────────────────────────────
model Product {               // EL producto real, deduplicado
  id         String   @id @default(uuid())
  title      String
  categoryId String?
  brandId    String?
  imageUrl   String?
  offers     Offer[]
  @@index([categoryId])
  @@index([brandId])
}

model Offer {                 // ese producto EN un sitio concreto
  id         String  @id @default(uuid())
  productId  String
  sourceId   String
  url        String
  externalId String?          // id del producto en la fuente
  prices     PriceObservation[]
  @@unique([sourceId, externalId])
  @@index([productId])
}

model PriceObservation {      // precio en el tiempo (ex-PriceHistory)
  id         String   @id @default(uuid())
  offerId    String
  price      Decimal  @db.Decimal(12, 2)
  currency   String   @default("USD")
  capturedAt DateTime @default(now())
  @@index([offerId, capturedAt])
}

// ─── Metadata de pipeline + auth ────────────────────────────
model EtlRun { ... }          // bookkeeping de corridas (operacional)
model QualityMetric { ... }   // métricas de calidad por corrida
model User { ... }            // auth JWT (sin cambios)
```

### 3.2 Por qué esta forma

- **`RawCapture`** es tu base "desestructurada". Un solo lugar inmutable para
  todo lo crudo. Hoy el JSON crudo vive en `Product.rawData` y se **pierde**
  cuando deduplicás. Separarlo te da auditoría y re-procesamiento.
- **`Product` vs `Offer`** es la separación clave. `Product` = "Pantalón Levi's
  501 azul". `Offer` = "ese pantalón, en este link de MercadoLibre". Un producto
  → N ofertas en N sitios. **Esto es lo que habilita comparar el mismo producto
  entre sitios.**
- **`PriceObservation`** (renombre de `PriceHistory`) cuelga de la **oferta**, no
  del producto. Así "un producto tiene varios precios" se cumple en las DOS
  dimensiones: en el tiempo (varias observaciones por oferta) y entre sitios
  (varias ofertas por producto).
- **`Category`/`Brand`** son tablas reales, indexadas. Tu ejemplo "pantalones →
  pantalones de tal marca" ahora es una query, no un parseo de JSON.

### 3.3 El punto difícil (honestidad)

Separar `Product` de `Offer` obliga a resolver **identidad de producto**: ¿cómo
sé que dos ofertas de dos sitios son el mismo producto? Ese matching difuso (por
título/marca/imagen) SÍ es un problema de ML legítimo — a diferencia de renombrar
`precio_total → precio`, que es un diccionario. **Recomendación: arrancar sin
dedup** (cada oferta crea su propio `Product`) y agregar el matching como fase
posterior cuando haya volumen. El modelo ya queda preparado.

---

## 4. Base ANALÍTICA — modelo estrella (DW)

Reusar el modelo estrella que ya existe (`schema.prisma` schema `dw`), movido a
la instancia física separada. Grano de `fact_productos`: un snapshot de precio
por producto × fuente × fecha.

```
                        ┌──────────────┐
                        │ dim_tiempo   │
                        └──────┬───────┘
   ┌────────────┐   ┌──────────┴─────────┐   ┌─────────────┐
   │ dim_fuente │──▶│   fact_productos   │◀──│ dim_categoria│
   └────────────┘   │  (precio_usd,      │   └─────────────┘
   ┌────────────┐   │   precio_raw,      │   ┌─────────────┐
   │ dim_moneda │──▶│   disponibilidad)  │◀──│ dim_marca ★ │  (NUEVA)
   └────────────┘   └─────────┬──────────┘   └─────────────┘
   ┌────────────┐             │              ┌─────────────┐
   │dim_producto│─────────────┴──────────────│dim_calificac│
   └────────────┘                            └─────────────┘

   (Módulo aparte: dim_genero + dim_fuente ──▶ fact_encuesta_consumo)
```

**Gap detectado:** el DW actual tiene 7 dimensiones pero **no tiene
`dim_marca`**. Si querés análisis por marca (y lo querés), hay que agregarla y
sumar la FK `id_marca` a `fact_productos`. Sin eso, "precio promedio por marca"
no se puede en el DW.

Mapeo ETL operacional → analítica:

| Operacional | → | Analítica (DW) |
|---|---|---|
| `Product` | → | `dim_producto` |
| `Category` | → | `dim_categoria` |
| `Brand` | → | `dim_marca` (nueva) |
| `Source` | → | `dim_fuente` |
| `PriceObservation` + fecha | → | `fact_productos` |

---

## 5. Casos de uso: qué se satisface y qué no

| Caso de uso | Modelo ACTUAL | Modelo PROPUESTO |
|---|---|---|
| Precio de un listing en el tiempo | ✅ (`PriceHistory`) | ✅ (`PriceObservation`) |
| Listado de productos por dominio | ✅ | ✅ |
| Análisis por categoría | ❌ (en JSON) | ✅ (`Category` + `dim_categoria`) |
| Análisis por marca | ❌ (en JSON) | ✅ (`Brand` + `dim_marca`) |
| Mismo producto más barato en otro sitio | ❌ (sin identidad) | ✅ (`Product` ↔ `Offer`) |
| Auditoría / re-proceso del crudo | ❌ (se pierde al dedup) | ✅ (`RawCapture` inmutable) |
| Calidad de datos antes de analizar | ⚠️ (tablas vacías) | ✅ (`QualityMetric` + 7 checks) |
| Dashboards agregados | ✅ (DW manual) | ✅ (DW por ETL automático) |

---

## 6. Migración por fases

1. **Fase 0** — split físico: levantar la 2da instancia Postgres, dividir el
   `schema.prisma` en `schema.operational.prisma` + `schema.analytics.prisma`,
   dos clientes Prisma, dos `DATABASE_URL`.
2. **Fase 1** — operacional: agregar `Source`, `Category`, `Brand`, `RawCapture`;
   migrar `Product`→`Product`+`Offer`; renombrar `PriceHistory`→`PriceObservation`.
3. **Fase 2** — DW: agregar `dim_marca`; mover el schema `dw` a la analítica.
4. **Fase 3** — ETL: implementar el `dw-loader` (T6.5, ya planeado) leyendo de la
   operacional y escribiendo en la analítica. Cerrar el ciclo automático.
5. **Fase 4** (futuro) — dedup difuso de productos (matching ML), si hace falta.

---

## 7. Estándar de datos de scrapeo (envelope canónico)

Regla: **hay un solo contrato de entrada al pipeline.** No importa si el dato lo
produjo la extensión o el scraper headless — ambos DEBEN emitir esta misma forma.
Así todo lo que viene después (stage, calidad, DW) es agnóstico del modo de
adquisición.

Los campos se reparten en tres baldes (ver §3.2): núcleo tipado, cola flexible
(`attributes` JSONB con claves canónicas), y crudo (`RawCapture`, aparte).

```ts
// Contrato único de entrada. Núcleo tipado + cola flexible.
interface ScrapedItem {
  // ── Identidad + trazabilidad ──
  source: string;         // "meli" | "aliexpress" | "temu" ...
  externalId?: string;    // id del producto en la fuente
  url: string;
  capturedAt: string;     // ISO 8601

  // ── Descriptivo ──
  title: string;
  description?: string;
  imageUrl?: string;

  // ── Clasificación (→ dimensiones DW) ──
  category?: string;      // slug canónico: "pantalones"
  brand?: string;         // slug canónico: "levis"

  // ── Comercial (el corazón del análisis) ──
  priceRaw?: string;      // "$1.299,00" tal cual salió
  price?: number;         // normalizado a decimal
  currency?: string;      // ISO 4217: "USD", "ARS"
  availability?: string;  // "in_stock" | "out_of_stock" ...
  rating?: number;        // 0–5
  reviewsCount?: number;

  // ── Cola flexible (específico por categoría) ──
  attributes?: Record<string, string>; // { color, talle, seller, ... }
}
```

**Regla de oro para la cola flexible:** un atributo de `attributes` asciende a
columna tipada / dimensión DW **solo cuando aparece un caso de uso concreto** que
lo filtra o agrega. No antes. Ej: si mañana importa "precio por color", promovés
`color` a `dim_color`. Mientras tanto vive genérico sin ensuciar el schema.

> Este envelope extiende el `canonicalField` que ya existe en
> `DomainRule.fieldMappings` (`title|price|imageUrl|sku|currency|description|
> category`). No se inventa de cero: se formaliza y amplía.

---

## 8. Flujo de scrapeo y puntos de persistencia (guardados)

Cada etapa del flujo tiene **un guardado distinto**, con lifecycle propio. Son
cuatro puntos de persistencia:

```
  EXTRACCIÓN                    (nada persistido todavía — en memoria)
  ├─ Modo A: extensión ─┐
  └─ Modo B: headless ──┴──▶ ScrapedItem[] (envelope canónico)
                                   │
   ── GUARDADO #1 ─────────────────▼─────────────────  BASE OPERACIONAL
   RawCapture (payload crudo, JSONB)          append-only · nunca se edita
                                   │
   ── GUARDADO #2 ─────────────────▼─────────────────  BASE OPERACIONAL
   normalización + calidad(7):                upsert idempotente
     · upsert Category / Brand                (misma corrida no duplica)
     · upsert Product  (por identidad)
     · upsert Offer    (@@unique source,externalId)
     · insert PriceObservation (append serie temporal)
                                   │
   ── GUARDADO #3 ─────────────────▼─────────────────  BASE OPERACIONAL
   QualityMetric + EtlRun.status                bookkeeping de la corrida
                                   │
   ── GUARDADO #4 ─────────────────▼─────────────────  BASE ANALÍTICA (DW)
   ETL carga star schema:                       carga por lotes
     · upsert dim_* (producto, fuente,          (idempotente por claves
       categoria, marca, tiempo, moneda)         de negocio)
     · insert fact_productos (grano: prod×fuente×fecha)
```

### Los cuatro guardados, en detalle

| # | Qué guarda | Dónde | Lifecycle | Por qué separado |
|---|---|---|---|---|
| **1. Raw** | `RawCapture` (JSONB del scrapeo, sin tocar) | Operacional | Append-only, inmutable | Auditoría + re-proceso si cambia la limpieza. Si el stage tiene un bug, re-corrés desde acá sin re-scrapear. |
| **2. Normalizado** | `Product`, `Offer`, `PriceObservation`, `Category`, `Brand`, `attributes` | Operacional | Upsert idempotente | Es lo que la app muestra. Re-correr la misma captura no duplica (claves únicas). El precio SÍ se acumula (serie temporal). |
| **3. Metadata** | `EtlRun` (estado), `QualityMetric` (7 checks) | Operacional | Insert + update de estado | Trazabilidad de la corrida: cuántas filas, cuántas pasaron calidad, si falló. No es dato de negocio, es "cómo salió el proceso". |
| **4. Analítico** | `fact_productos` + `dim_*` | Analítica (DW) | Carga por lotes | Optimizado para leer/agregar. Reconstruible entero desde el guardado #2. |

### Puntos clave del flujo

- **Los dos modos convergen en el envelope.** La extensión y el headless emiten
  la MISMA `ScrapedItem[]`. Todo lo de abajo del guardado #1 no sabe (ni le
  importa) de dónde vino. Eso es lo que mantiene el pipeline simple.
- **Idempotencia = re-scrapear no rompe.** Guardado #2 es upsert por claves de
  negocio. Scrapear el mismo producto dos veces actualiza la oferta y agrega UNA
  observación de precio nueva — no duplica el producto.
- **El precio es la excepción append.** Todo se upsertea salvo
  `PriceObservation`, que siempre inserta: es la serie temporal, la querés
  completa.
- **La analítica es desechable.** Si el DW se corrompe, TRUNCATE + re-cargar
  desde el guardado #2. La operacional nunca se reconstruye desde la analítica.

---

## 9. Decisiones abiertas

- **Dedup de producto**: ¿arrancamos 1 oferta = 1 producto (simple) y agregamos
  matching después? (recomendado)
- **`Category`/`Brand`**: ¿de dónde salen? ¿mapeo determinístico por fuente, o
  taxonomía propia mantenida a mano?
- **Instancia física de la 2da DB**: ¿otro contenedor Postgres en el mismo
  `docker-compose`, o base separada en la misma instancia? (para el proyecto,
  otro contenedor es lo más limpio y realista).
