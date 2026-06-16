# Docker — Contenerización

## Estructura

```
docker/
├── Dockerfile.backend     # Build multi-etapa para NestJS
├── Dockerfile.frontend    # Build multi-etapa para Angular + Nginx
├── Dockerfile.worker      # Build multi-etapa para Crawlee worker
└── nginx.conf             # Configuración del servidor Nginx
```

## Servicios

| Servicio | Puerto | Depende de | Descripción |
|----------|--------|------------|-------------|
| `postgres` | `5432` | — | Base de datos PostgreSQL 16 |
| `rabbitmq` | `5672`, `15672` | — | Message broker RabbitMQ 4 |
| `backend` | `3000` | postgres, rabbitmq | API NestJS |
| `frontend` | `8080` | backend | SPA Angular servida por Nginx |
| `worker` | — | postgres, rabbitmq | Worker Crawlee (sin puertos expuestos) |

## Docker Compose

El archivo `docker-compose.yml` en la raíz orquesta todos los servicios en una red compartida llamada `scraper-network`.

### Variables de entorno

Todas las variables sensibles se inyectan desde `.env` (raíz). El `docker-compose.yml` usa valores por defecto con `${VARIABLE:-default}`.

### Healthchecks

Cada servicio tiene healthchecks para garantizar que el backend y el worker no arranquen hasta que PostgreSQL y RabbitMQ estén listos:

```yaml
postgres:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U scraper -d scraperdb"]
    interval: 10s
    retries: 5

rabbitmq:
  healthcheck:
    test: ["CMD", "rabbitmq-diagnostics", "-q", "ping"]
    interval: 15s
    retries: 5
```

## Dockerfiles Multi-Etapa

### Backend

```
Base (node:22-alpine + corepack + pnpm)
  │
  ▼
Builder (pnpm fetch → install → prisma generate → build → pnpm deploy)
  │
  ▼
Runner (solo copia node_modules + dist + prisma → corre como node)
```

Usa `pnpm deploy --prod` para extraer solo las dependencias de producción a una carpeta limpia, resultando en imágenes más livianas.

### Frontend

```
Builder (pnpm install → ng build)
  │
  ▼
Production (nginx:1.27-alpine + copia bundle compilado)
```

El frontend en producción es servido por Nginx, no por Node.js.

### Worker

```
Base (node:22-alpine + chromium + corepack + pnpm)
  │
  ▼
Builder (pnpm fetch → install → build → pnpm deploy)
  │
  ▼
Runner (solo node_modules + dist → corre como node)
```

El worker incluye Chromium directamente en la imagen para que Playwright pueda ejecutar el navegador headless sin dependencias externas.

## Comandos

```bash
# Construir e iniciar todos los servicios
docker compose up -d --build

# Ver logs de un servicio específico
docker compose logs -f backend
docker compose logs -f worker

# Ejecutar un comando en un servicio
docker compose exec postgres psql -U scraper -d scraperdb

# Ver colas de RabbitMQ
docker compose exec rabbitmq rabbitmqctl list_queues

# Detener todo
docker compose down

# Detener y eliminar volúmenes (borra datos)
docker compose down -v
```

## RabbitMQ Management UI

Cuando los servicios están corriendo, abrí:

- **URL**: http://localhost:15672
- **User**: `scraper`
- **Password**: `scraperpass`

Desde ahí podés ver las colas, los mensajes, las conexiones activas y el estado del worker en tiempo real.
