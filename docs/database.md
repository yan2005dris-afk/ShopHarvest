# Base de Datos — PostgreSQL + Prisma

## Tecnología

**PostgreSQL 16** como base de datos relacional y **Prisma** como ORM (Object-Relational Mapping).

**Por qué PostgreSQL:**
- Maduro, confiable y con excelente soporte de tipos
- JSONB para almacenar datos raw del scraping
- Full-text search para búsqueda de productos
- Performance probada en cargas de trabajo analíticas

**Por qué Prisma:**
- TypeScript nativo — tipos generados automáticamente
- Migraciones declarativas
- IDE autocompletado en las consultas
- Separación del esquema en múltiples archivos

## Modelos

### DomainRule

Reglas de extracción por dominio. El usuario define estos selectores desde el frontend visual.

```prisma
model DomainRule {
  id              String   @id @default(uuid())
  domain          String   @unique  // "temu.com", "shein.com"
  name            String            // "Temu", "Shein"

  selectorTitle   String            // CSS/XPath para el título
  selectorPrice   String            // Selector del precio
  selectorImage   String?           // Selector de la imagen
  selectorSku     String?           // Selector del SKU

  selectorType    String   @default("css")  // "css" | "xpath"
  paginationType  String   @default("scroll") // scroll | pagination | load-more
  paginationSelector String?

  sampleUrl       String?
  lastScrapedAt   DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  products        Product[]
}
```

### Product

Datos normalizados extraídos de los sitios. Todos los productos tienen la misma estructura sin importar su origen.

```prisma
model Product {
  id           String   @id @default(uuid())
  domainRuleId String
  domainRule   DomainRule @relation(fields: [domainRuleId], references: [id])

  externalId   String?          // ID en la fuente original
  title        String
  price        Decimal  @db.Decimal(12, 2)
  currency     String   @default("USD")
  imageUrl     String?
  productUrl   String
  sku          String?
  description  String?

  rawData      Json?            // JSON original del scraping
  extractedAt  DateTime @default(now())

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  priceHistory PriceHistory[]
}
```

### PriceHistory

Historial de precios para tracking temporal. Cada vez que se extrae un producto, se crea un registro aquí.

```prisma
model PriceHistory {
  id         String   @id @default(uuid())
  productId  String
  product    Product  @relation(fields: [productId], references: [id])

  price      Decimal  @db.Decimal(12, 2)
  currency   String   @default("USD")
  capturedAt DateTime @default(now())

  createdAt  DateTime @default(now())
}
```

## Relaciones

```
DomainRule (1) ────── (N) Product (1) ────── (N) PriceHistory
     │                      │
     │                   extractedAt
     │                   externalId
     │                   rawData (JSON)
     │
  domain (único por regla)
  selectores (CSS/XPath)
```

## Comandos Prisma

```bash
# Sincronizar esquema a la base sin migración
pnpm prisma:push

# Crear una migración
pnpm prisma:migrate --name init

# Abrir Prisma Studio (UI para ver datos)
pnpm --filter backend prisma studio

# Generar cliente Prisma (después de cambiar el schema)
pnpm prisma:generate
```
