# WebScrapingDinámico-Automático

Plataforma ETL semi-automatizada para extracción visual de datos en e-commerce (Temu, Shein y afines).

## Stack

| Capa           | Tecnología                          |
|----------------|--------------------------------------|
| Frontend       | Angular 22 (visor HTML + selector)  |
| Backend        | NestJS 11 (API REST)                |
| Worker         | Node.js + Crawlee (Playwright)      |
| Cola           | RabbitMQ                            |
| Base de datos  | PostgreSQL 16 + Prisma              |
| Analítica      | Grafana / Apache Superset (futuro)  |

## Arquitectura

```
[Angular] → API NestJS → RabbitMQ → Worker Crawlee → PostgreSQL
     ↑                                       │
     └─────────── visual mapper ──────────────┘
```

Servicios independientes contenerizados (Docker) que se comunican por API REST y cola de mensajes RabbitMQ. El usuario selecciona visualmente elementos en una página renderizada, se guardan reglas dinámicas por dominio, y un worker batch extrae los datos.

## Estructura del proyecto

```
├── .env                    # Variables de entorno
├── docker-compose.yml      # Orquestación de servicios
├── docker/                 # Dockerfiles y configs
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── Dockerfile.worker
│   └── nginx.conf
│
├── backend/                # 🎯 NestJS + Prisma + RabbitMQ
│   ├── prisma/schema/      # Modelos: DomainRule, Product, PriceHistory
│   └── src/
│       ├── common/         # PrismaModule, RabbitmqModule
│       └── modules/        # domains, products, scraping-jobs
│
├── frontend/               # 🎨 Angular 22
│   ├── src/app/pages/
│   │   ├── url-input/      # Input de URL
│   │   └── visual-mapper/  # Render DOM + selector visual
│   └── src/app/services/   # ApiService
│
└── worker/                 # 🤖 Crawlee + RabbitMQ consumer
    ├── src/
    │   ├── consumer.ts     # Escucha cola scraping-jobs
    │   ├── scraper.ts      # PlaywrightCrawler con selectores
    │   └── types.ts        # Tipos compartidos
```

## Inicio rápido

```bash
# 1. Instalar dependencias
pnpm install

# 2. Levantar servicios (PostgreSQL + RabbitMQ)
docker compose up -d postgres rabbitmq

# 3. Inicializar base de datos
pnpm prisma:push

# 4. Arrancar backend + frontend + worker
pnpm dev:backend
pnpm dev:frontend
pnpm dev:worker
```

## Comandos útiles

| Comando                     | Descripción                           |
|-----------------------------|---------------------------------------|
| `pnpm dev:backend`          | Backend NestJS en modo watch          |
| `pnpm dev:frontend`         | Frontend Angular con proxy a :3000    |
| `pnpm dev:worker`           | Worker Crawlee en modo watch          |
| `pnpm build:backend`        | Compilar backend                      |
| `pnpm build:frontend`       | Compilar frontend                     |
| `pnpm build:worker`         | Compilar worker                       |
| `pnpm prisma:push`          | Sincronizar esquema a PostgreSQL      |
| `pnpm prisma:migrate`       | Crear migración Prisma                |
| `docker compose up -d`      | Levantar todos los servicios          |
| `docker compose down`       | Bajar servicios                       |

## Modelos de datos

- **DomainRule**: Reglas de extracción por dominio (selectores CSS/XPath)
- **Product**: Datos normalizados de productos extraídos
- **PriceHistory**: Historial de precios para dashboards
