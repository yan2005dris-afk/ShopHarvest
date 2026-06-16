# Backend — NestJS 11

## Tecnología

**NestJS 11** con TypeScript estricto. Framework progresivo de Node.js que usa decoradores y una arquitectura modular inspirada en Angular.

**Por qué NestJS:**
- Arquitectura modular por defecto (módulos, controladores, servicios)
- Integración nativa con RabbitMQ vía `@nestjs/microservices`
- Soporte de primer clase para Prisma
- TypeScript estricto desde el inicio
- CLI madura con generación de código

## Dependencias Principales

| Paquete | Propósito |
|---------|-----------|
| `@nestjs/config` | Variables de entorno |
| `@nestjs/microservices` | Transporte RabbitMQ |
| `@prisma/client` | ORM para PostgreSQL |
| `amqplib` | Cliente AMQP para RabbitMQ |
| `class-validator` / `class-transformer` | Validación de DTOs |

## Estructura de Módulos

```
src/
├── main.ts                          # Entry point
├── app.module.ts                    # Módulo raíz
├── common/
│   ├── prisma/
│   │   ├── prisma.module.ts         # Módulo global de Prisma
│   │   └── prisma.service.ts        # Servicio singleton del cliente Prisma
│   └── rabbitmq/
│       ├── rabbitmq.config.ts       # Config de conexión RabbitMQ
│       └── rabbitmq.module.ts       # Módulo RabbitMQ
└── modules/
    ├── domains/                     # CRUD de DomainRule
    │   ├── domains.controller.ts    # Endpoints REST
    │   ├── domains.service.ts       # Lógica de negocio
    │   └── domains.module.ts        # Registro del módulo
    ├── products/                    # CRUD de Product
    │   ├── products.controller.ts
    │   ├── products.service.ts
    │   └── products.module.ts
    └── scraping-jobs/               # Encolado de trabajos
        ├── scraping-jobs.controller.ts
        ├── scraping-jobs.service.ts
        └── scraping-jobs.module.ts
```

## Endpoints de la API

### Domain Rules
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/domains` | Listar todas las reglas |
| `GET` | `/api/domains/:id` | Obtener una regla |
| `POST` | `/api/domains` | Crear regla (desde el mapeo visual) |
| `PUT` | `/api/domains/:id` | Actualizar selectores |
| `DELETE` | `/api/domains/:id` | Eliminar regla |

### Products
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/products` | Listar productos (con filtros) |
| `GET` | `/api/products/:id` | Detalle de producto + historial |
| `GET` | `/api/products/:id/history` | Historial de precios |

### Scraping Jobs
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/scraping-jobs` | Encolar nuevo trabajo de scraping |
| `GET` | `/api/scraping-jobs/:id` | Estado de un trabajo |

## RabbitMQ

NestJS se conecta a RabbitMQ usando `@nestjs/microservices` con transporte AMQP.

**Flujo de encolado:**
1. El frontend o un cron llama a `POST /api/scraping-jobs`
2. El servicio `ScrapingJobsService` publica un mensaje en la cola `scraping-jobs`
3. El mensaje contiene: `{ jobId, url, domainRuleId, selectors, selectorType }`
4. El worker consume el mensaje y procesa el scraping

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
