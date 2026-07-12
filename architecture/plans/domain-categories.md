# Plan: Domain Categories + Field-Type Badges

## Why

El scraper asistido funciona con múltiples dominios (Temu, Shein, Tía, Tutti, etc.) y no hay forma de diferenciar qué tipo de datos se están scrapeando. Una categoría por dominio permite:

- Organizar los productos por tipo (Ropa, Comida, Electrónica, General)
- En el preview saber de un vistazo qué se está scrapeando y qué tipo de campos se mapearon
- (Futuro) Filtrar productos por categoría en el listado

---

## 1. Modelo de datos

### DomainRule (Prisma)

Agregar columna opcional `category`:

```prisma
model DomainRule {
  id               String   @id @default(cuid())
  domain           String   @unique
  name             String
  category         String?  // ← NUEVO: "Ropa", "Comida", "Electrónica", "General", etc.
  fieldMappings    Json?
  containerSelector String?
  // ... resto igual
}
```

### Auto-suggest table (frontend, lookup in-memory)

```typescript
const DOMAIN_CATEGORIES: Record<string, string> = {
  'temu.com': 'General',
  'shein.com': 'Ropa',
  'aliexpress.com': 'Electrónica / Varios',
  'tia.com.ec': 'Supermercados',
  'tutti.ec': 'Supermercados',
  'supermaxi.com': 'Supermercados',
  'mercadolibre.com.ec': 'General',
};
```

---

## 2. Backend

### DTOs

| Archivo | Cambio |
|---|---|
| `CreateDomainDto` | Agregar `category?: string` opcional |
| `UpdateDomainDto` | Agregar `category?: string` |
| `DomainResponseDto` | Agregar `category: string \| null` |
| `IngestProductsDto` | Agregar `category?: string` (para auto-crear la rule con categoría) |

### Endpoint `POST /products/ingest`

Si el `IngestProductsDto` incluye `category` y la `DomainRule` se crea (no existía), la guarda junto con los fieldMappings. Si ya existe, no sobreescribe.

---

## 3. Frontend — Visual Mapper

### 3a. Hero state — Category selector

```
┌─────────────────────────────────────────────┐
│  https://www.tia.com.ec/...  [🌐]          │
│                                             │
│  Categoría: [Supermercados        ▾]        │
│            ┌─────────────────────┐          │
│            │ General             │          │
│            │ Ropa                │          │
│            │ Supermercados       │          │
│            │ Electrónica         │          │
│            │ Hogar               │          │
│            │ ──────────────      │          │
│            │ Personalizado...    │          │
│            └─────────────────────┘          │
│                                             │
│  [ → Open Mapper ]                          │
└─────────────────────────────────────────────┘
```

- Al escribir una URL, auto-sugiere la categoría según `DOMAIN_CATEGORIES`
- El usuario puede cambiarla manualmente
- Si el dominio no está en la lookup, deja vacío o "General"

### 3b. Mapping state — Preview header + badges

```
┌── Field Mappings ──┐  ┌── Preview ──────────────────────┐
│                     │  │                                 │
│ Temu Ecuador        │  │  Temu Ecuador                   │
│ Categoría: General  │  │  Categoría: General             │
│                     │  │                                 │
│ 3 field(s) mapped   │  │  📸 Imagen detectado   (120)   │
│                     │  │  💰 Precio detectado    (126)   │
│ ✓ imagen     [×]    │  │  📝 Título detectado    (64)    │
│ ✓ titulo     [×]    │  │                                 │
│ ✓ precio     [×]    │  │  ┌─────────────────────────┐    │
│                     │  │  │ [imagen]                │    │
│ Container           │  │  │                         │    │
│ ✓ #main_scale > ... │  │  │ Título del producto     │    │
│                     │  │  │ $3.18                   │    │
│ [Save Domain Rule]  │  │  └─────────────────────────┘    │
│ [Save Products(64)] │  │                                 │
└─────────────────────┘  └─────────────────────────────────┘
```

#### Badges por tipo de campo

| Condición | Badge |
|---|---|
| Field name contiene `imagen` / `img` / `foto` | `📸 Imagen detectado (N)` |
| Field name contiene `precio` / `price` | `💰 Precio detectado (N)` |
| Field name contiene `titulo` / `title` / `name` | `📝 Título detectado (N)` |
| Field name contiene `desc` / `description` | `📄 Descripción detectada` |
| Field name contiene `sku` | `🏷️ SKU detectado` |

Los badges se muestran en el panel del preview con la cantidad de matches (del field selector).

---

## 4. Extension

Sin cambios. La categoría es metadata del dominio, no influye en la extracción.

---

## 5. Implementación (orden sugerido)

| # | Archivos | Qué |
|---|---|---|
| 1 | `prisma/schema.prisma` | Agregar `category` a DomainRule |
| 2 | `packages/contracts/src/domains/*` | Agregar category a DTOs |
| 3 | `backend/src/modules/products/products.service.ts` | Usar category de IngestProductsDto |
| 4 | `frontend/src/app/services/api.service.ts` | Types de DomainRule con category |
| 5 | `frontend/src/app/pages/visual-mapper/components/mapper-hero.component.ts` | Category selector + auto-suggest |
| 6 | `frontend/src/app/pages/visual-mapper/components/mapping-state.component.ts` | Pasar category al preview |
| 7 | `frontend/src/app/pages/visual-mapper/components/extracted-preview.component.ts` | Badges + category header |
| 8 | `frontend/src/app/pages/visual-mapper/services/mapping-session.service.ts` | category signal |
| 9 | `frontend/src/app/pages/visual-mapper/services/domain-rule.persistence.ts` | category en save params |
| 10 | `frontend/src/app/pages/visual-mapper/visual-mapper.page.ts` | category flow |

---

## 6. Migración

- `prisma migrate dev` agrega la columna nullable a DomainRule existentes
- Los domains viejos se quedan con `category = null` (se muestra "General" por defecto)
