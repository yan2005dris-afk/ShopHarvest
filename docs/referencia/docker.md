# Docker — Contenerización

## Estructura

```
docker/
├── Dockerfile.backend     # Build multi-etapa para NestJS
└── Dockerfile.frontend    # Build multi-etapa para Angular + Nginx
```

> El worker Crawlee fue eliminado. Ya no hay `Dockerfile.worker` ni configuración de RabbitMQ.

## Servicios

| Servicio | Puerto | Depende de | Descripción |
|----------|--------|------------|-------------|
| `postgres` | `5432` | — | Base de datos PostgreSQL 16 |
| `backend` | `3000` | postgres | API NestJS |
| `frontend` | `8080` | backend | SPA Angular servida por Nginx |

## Docker Compose

El archivo `docker-compose.yml` en la raíz orquesta los servicios en una red compartida llamada `scraper-network`.

### Variables de entorno

Todas las variables sensibles se inyectan desde `.env` (raíz). El `docker-compose.yml` usa valores por defecto con `${VARIABLE:-default}`.

### Healthchecks

```yaml
postgres:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U scraper -d scraperdb"]
    interval: 10s
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

Usa `pnpm deploy --prod` para extraer solo las dependencias de producción, resultando en imágenes más livianas.

### Frontend

```
Builder (pnpm install → ng build)
  │
  ▼
Production (nginx:1.27-alpine + copia bundle compilado)
```

El frontend en producción es servido por Nginx, no por Node.js.

## Extensión Chrome

La extensión Chrome (`extension/`) **no se conteneriza**. Se build con Vite y se carga manualmente en el navegador:

```bash
cd extension
pnpm build
# Cargar ./dist en chrome://extensions con modo developer activado
```

## Comandos

```bash
# Construir e iniciar todos los servicios
docker compose up -d --build

# Ver logs de un servicio específico
docker compose logs -f backend
docker compose logs -f frontend

# Ejecutar un comando en un servicio
docker compose exec postgres psql -U scraper -d scraperdb

# Detener todo
docker compose down

# Detener y eliminar volúmenes (borra datos)
docker compose down -v
```
