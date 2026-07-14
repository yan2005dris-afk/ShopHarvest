# WebScrapingDinámico-Automático

Plataforma ETL semi-automatizada para extracción visual de datos en e-commerce (Temu, Shein y afines). Usa una **extensión de Chrome** para el scraping en el navegador real del usuario, evitando bloqueos por CAPTCHA.

## Stack

| Capa           | Tecnología                         |
|----------------|------------------------------------|
| Frontend       | Angular 22                         |
| Extensión      | Chrome MV3 (Vite + TypeScript)     |
| Backend        | NestJS 11 (API REST)               |
| Base de datos  | PostgreSQL 16 + Prisma             |

## Arquitectura

```
[Chrome Extension] ←→ [Angular] ←→ [NestJS API] ←→ [PostgreSQL]
       ↕ (chrome.runtime)
  [Página web real]
     (sin CAPTCHA)
```

La extensión reemplazó al stack anterior (RabbitMQ + Worker Crawlee/Playwright headless) que era bloqueado por Cloudflare/CAPTCHA. Ahora el scraping corre en la sesión auténtica del usuario.

## Estructura del proyecto

```
├── extension/              # 🧩 Chrome MV3 Extension
│   ├── manifest.json       # Permisos: storage, activeTab, scripting
│   ├── src/
│   │   ├── background/     # Service Worker (sesiones + storage)
│   │   ├── content/        # Content script (overlay + extracción)
│   │   └── popup/          # UI del popup (HTML + TypeScript)
│   └── vite.config.ts      # Build con Vite
│
├── backend/                # 🎯 NestJS + Prisma
│   ├── prisma/schema/      # Modelos: DomainRule, Product, PriceHistory
│   └── src/
│       ├── common/         # PrismaModule
│       └── modules/        # domains, products
│
├── frontend/               # 🎨 Angular 22
│   ├── src/app/
│   │   ├── pages/
│   │   │   └── visual-mapper/  # Integración con extensión
│   │   └── services/       # ApiService
│   └── proxy.conf.json     # Proxy a backend en desarrollo
│
├── docker/                 # 🐳 Dockerfiles
│   ├── Dockerfile.backend
│   └── Dockerfile.frontend
│
├── compose.yaml            # unified stack: postgres + postgres-dw + backend + frontend + cloudflared (profile)
└── PLAN.md                 # Plan de mejora continua
```

## Inicio rápido

```bash
# 1. Instalar dependencias
pnpm install

# 2. Build de la extensión
cd extension && pnpm build
# Cargar extension/dist en chrome://extensions (modo developer)

# 3. Levantar servicios (solo PostgreSQL + backend + frontend)
docker compose up -d

# 4. O en modo desarrollo
pnpm dev:backend
pnpm dev:frontend
```

## Comandos útiles

| Comando                     | Descripción                           |
|-----------------------------|---------------------------------------|
| `pnpm dev:backend`          | Backend NestJS en modo watch          |
| `pnpm dev:frontend`         | Frontend Angular con proxy a :3000    |
| `pnpm build:backend`        | Compilar backend                      |
| `pnpm build:frontend`       | Compilar frontend                     |
| `pnpm prisma:push`          | Sincronizar esquema a PostgreSQL      |
| `pnpm prisma:migrate`       | Crear migración Prisma                |
| `cd extension && pnpm build`| Build de la extensión                 |
| `docker compose up -d`      | Levantar todos los servicios          |
| `docker compose down`       | Bajar servicios                       |

## Modelos de datos

- **DomainRule**: Reglas de extracción por dominio (`fieldMappings` + `containerSelector`)
- **Product**: Datos normalizados de productos extraídos
- **PriceHistory**: Historial de precios para dashboards

## Notas

- La extensión se comunica con Angular via `chrome.runtime.connectExternal`
- Los datos se guardan localmente en `chrome.storage.local` y se sincronizan con el backend
- No requiere RabbitMQ ni worker headless — todo corre en el navegador del usuario
