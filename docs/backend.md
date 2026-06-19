# Backend — NestJS 11

## Tecnología

**NestJS 11** con TypeScript estricto. Framework progresivo de Node.js que usa decoradores y una arquitectura modular inspirada en Angular.

**Por qué NestJS:**
- Arquitectura modular por defecto (módulos, controladores, servicios)
- Soporte de primer clase para Prisma
- TypeScript estricto desde el inicio
- CLI madura con generación de código

## Dependencias Principales

| Paquete | Propósito |
|---------|-----------|
| `@nestjs/config` | Variables de entorno |
| `@prisma/client` | ORM para PostgreSQL |
| `class-validator` / `class-transformer` | Validación de DTOs |

> RabbitMQ fue eliminado. La extracción la hace la extensión Chrome directamente, no hay worker ni cola de mensajes.

## Estructura de Módulos

```
src/
├── main.ts                          # Entry point
├── app.module.ts                    # Módulo raíz
├── common/
│   └── prisma/
│       ├── prisma.module.ts         # Módulo global de Prisma
│       └── prisma.service.ts        # Servicio singleton del cliente Prisma
└── modules/
    ├── domains/                     # CRUD de DomainRule
    │   ├── domains.controller.ts    # Endpoints REST
    │   ├── domains.service.ts       # Lógica de negocio
    │   └── domains.module.ts        # Registro del módulo
    └── products/                    # CRUD de Product
        ├── products.controller.ts
        ├── products.service.ts
        └── products.module.ts
```

## Endpoints de la API

### Domain Rules
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/domains` | Listar todas las reglas |
| `GET` | `/api/domains/:id` | Obtener una regla |
| `GET` | `/api/domains/:id/products` | Productos de una regla específica |
| `POST` | `/api/domains` | Crear regla (fieldMappings + containerSelector) |
| `PUT` | `/api/domains/:id` | Actualizar regla |
| `DELETE` | `/api/domains/:id` | Eliminar regla |
| `DELETE` | `/api/domains/:id/products` | Limpiar productos de una regla |

### Products
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/products` | Listar productos (con filtros) |
| `GET` | `/api/products/:id` | Detalle de producto + historial |
| `GET` | `/api/products/:id/history` | Historial de precios |
| `PATCH` | `/api/products/:id` | Editar producto manualmente |

### Ingest (desde la extensión)
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/products/ingest` | Recibe productos extraídos desde la extensión |

## DomainRule — Nuevos campos

Las reglas ya no usan selectores individuales (`selectorTitle`, `selectorPrice`, etc.). En su lugar usan:

- **`fieldMappings`** (`Json`): Array de `{ canonicalField, selector, type, attribute? }`
- **`containerSelector`** (`String`): Selector CSS del contenedor de cada producto

```typescript
interface FieldMapping {
  canonicalField: 'title' | 'price' | 'imageUrl' | 'sku' | 'currency' | 'description' | 'category';
  selector: string;        // selector CSS generado por la extensión
  type: 'text' | 'attribute' | 'html';
  attribute?: string;      // ej: 'src' para imageUrl
}
```

## Prisma

El esquema se divide en archivos separados dentro de `prisma/schema/`:

```
prisma/
├── schema.prisma          # Entry point (generator + datasource)
└── schema/
    ├── base.prisma         # Configuración del generador y conexión
    └── models/
        ├── domain_rule.prisma
        ├── product.prisma
        └── price_history.prisma
```

## Productos desde la extensión

La extensión envía productos vía `POST /products/ingest` con esta estructura:

```json
{
  "domain": "www.temu.com",
  "pageUrl": "https://www.temu.com/category-xxx",
  "products": [
    { "title": "Auriculares Pro", "price": 29.99, "imageUrl": "https://..." }
  ]
}
```

El backend los normaliza y persiste como `Product` + `PriceHistory`.
