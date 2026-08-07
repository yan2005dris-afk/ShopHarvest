# 🚀 Guía de Despliegue — WebScrapingDinamico-Automatico

**Fecha**: 2026-07-21  
**Estado**: ✅ Proyecto funcional y listo para usar  
**Ambiente**: Local development con Docker

---

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Estructura del Proyecto](#estructura-del-proyecto)
3. [Paso a Paso: Configuración Inicial](#paso-a-paso-configuración-inicial)
4. [Paso a Paso: Base de Datos](#paso-a-paso-base-de-datos)
5. [Paso a Paso: Generación de Clientes](#paso-a-paso-generación-de-clientes)
6. [Paso a Paso: Build de Contracts](#paso-a-paso-build-de-contracts)
7. [Ejecución del Proyecto](#ejecución-del-proyecto)
8. [Acceso y Credenciales](#acceso-y-credenciales)
9. [Troubleshooting](#troubleshooting)

---

## 📦 Requisitos Previos

Verificar que tienes instalado:

```bash
# Verificar Node.js (>= 20)
node --version
# Esperado: v22.23.1 ✓

# Verificar pnpm (>= 9)
pnpm --version
# Esperado: 11.1.1 ✓

# Verificar Docker
docker --version
# Esperado: Docker version 27.x.x ✓

# Verificar Docker Compose
docker-compose --version
# Esperado: Docker Compose version 2.x.x ✓
```

**Si falta algo**: Instala desde:
- Node: https://nodejs.org/
- pnpm: `npm install -g pnpm`
- Docker: https://www.docker.com/

---

## 🏗️ Estructura del Proyecto

```
WebScrapingDinamico-Automatico/
├── backend/                          # NestJS 11 API
│   ├── prisma/
│   │   ├── operational/              # Schema operacional (datos de scraping)
│   │   │   ├── schema.prisma
│   │   │   ├── prisma.config.js      # Config Prisma 7
│   │   │   └── migrations/
│   │   ├── analytics/                # Schema data warehouse
│   │   │   ├── schema.prisma
│   │   │   ├── prisma.config.js
│   │   │   └── migrations/
│   │   └── seed.ts                   # Seed data (admin + categorías)
│   ├── src/generated/                # Prisma clients auto-generados
│   │   ├── operational/
│   │   └── analytics/
│   ├── package.json
│   └── prisma.config.js
│
├── frontend/                         # Angular 22 SPA
│   ├── src/
│   │   ├── app/pages/
│   │   │   ├── visual-mapper/
│   │   │   ├── products/
│   │   │   ├── dashboard/
│   │   │   └── domains/
│   │   └── main.ts
│   └── package.json
│
├── extension/                        # Chrome MV3
│   ├── src/
│   │   ├── background/
│   │   ├── content-script.ts
│   │   └── manifest.json
│   ├── package.json
│   └── vite.config.ts
│
├── packages/contracts/               # Shared DTOs
│   ├── src/
│   └── package.json
│
├── .env                              # Variables globales
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── DEPLOYMENT_GUIDE.md               # Este archivo
```

---

## 🔧 Paso a Paso: Configuración Inicial

### 1.1 Entrar al Proyecto

```bash
cd /path/to/WebScrapingDinamico-Automatico
```

### 1.2 Verificar `.env`

```bash
ls -la .env
cat .env | head -20
```

**Variables críticas**:
```env
DATABASE_URL=postgresql://scraper:scraperpass@localhost:5433/scraperdb
ANALYTICS_DATABASE_URL=postgresql://scraper:scraperpassdw@localhost:5434/scraperdw
JWT_SECRET=36ff51e91b9416374e565a44d7515b6d551d17da0defff5dcb42a225a8d8a8a1
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=adminpassword
```

### 1.3 Instalar Dependencias

```bash
pnpm install
# Esperado: added XXX packages in XXs
```

---

## 🗄️ Paso a Paso: Base de Datos

### 2.1 Levantar PostgreSQL en Docker

```bash
docker-compose up -d postgres redis
```

Verificar:
```bash
docker ps | grep postgres
```

### 2.2 Verificar Conectividad

```bash
# Operational DB
psql -h localhost -p 5433 -U scraper -d scraperdb -c "SELECT 1"
# Contraseña: scraperpass

# Analytics DB
psql -h localhost -p 5434 -U scraper -d scraperdw -c "SELECT 1"
# Contraseña: scraperpassdw
```

### 2.3 Migrar Operational Schema

```bash
cd backend

pnpm prisma migrate dev \
  --schema=prisma/operational/schema.prisma \
  --url="postgresql://scraper:scraperpass@localhost:5433/scraperdb"
```

Responder: `init`

Esperado:
```
✔ Enter a name for the new migration: init
Applying migration `20260721035724_init`
Your database is now in sync with your schema.
```

### 2.4 Verificar Analytics Schema

```bash
pnpm prisma migrate dev \
  --schema=prisma/analytics/schema.prisma \
  --url="postgresql://scraper:scraperpassdw@localhost:5434/scraperdw"
```

Esperado:
```
Already in sync, no schema change or pending migration was found.
```

---

## 🌱 Paso a Paso: Seed (Datos Iniciales)

### 3.1 Ejecutar Script de Seed

```bash
# Desde backend/
DATABASE_URL=postgresql://scraper:scraperpass@localhost:5433/scraperdb npx tsx prisma/seed.ts
```

Esperado:
```
Default user seeded successfully.
9 categories seeded successfully.
```

**Qué se crea**:
- ✅ Usuario: `admin@example.com` / `adminpassword`
- ✅ 9 categorías: Ropa, Electrónica, Supermercados, Hogar, Deportes, Juguetes, Belleza, Mascotas, Libros

---

## 🔌 Paso a Paso: Generación de Clientes

### 4.1 Generar Prisma Client (Operational)

```bash
pnpm prisma generate --schema=prisma/operational/schema.prisma
```

Esperado:
```
✔ Generated Prisma Client (v7.8.0) to ./src/generated/operational in 92ms
```

### 4.2 Generar Prisma Client (Analytics)

```bash
pnpm prisma generate --schema=prisma/analytics/schema.prisma
```

Esperado:
```
✔ Generated Prisma Client (v7.8.0) to ./src/generated/analytics in 75ms
```

---

## 📦 Paso a Paso: Build de Contracts

### 5.1 Compilar DTOs Compartidos

```bash
# Desde raíz
cd ..

pnpm build:contracts
```

Esperado:
```
$ pnpm --filter @web-scraping/contracts build
$ tsc -p tsconfig.build.json && tsc -p tsconfig.build.cjs.json && echo '{"type":"commonjs"}' > dist-cjs/package.json
(completa sin errores)
```

---

## 🚀 Ejecución del Proyecto

### Opción A: Docker Compose (Recomendado)

```bash
docker-compose up -d
```

Verificar:
```bash
docker-compose ps
```

**Acceso**:
- Frontend: http://localhost:8080
- Backend: http://localhost:3000/api
- Docs: http://localhost:3000/api/docs

---

### Opción B: Local Development

#### Terminal 1: Backend

```bash
cd backend
pnpm dev
```

Esperado: `✓ Server running on http://localhost:3000`

#### Terminal 2: Frontend

```bash
cd frontend
pnpm start
```

Acceso: http://localhost:4200

#### Terminal 3: Extension (Opcional)

```bash
cd extension
pnpm dev
```

---

## 🔐 Acceso y Credenciales

### URLs

```
Frontend:    http://localhost:8080 (Docker) | http://localhost:4200 (local)
Backend:     http://localhost:3000/api
Swagger:     http://localhost:3000/api/docs
```

### Credenciales

```
Email:    admin@example.com
Password: adminpassword
```

---

## 🛠️ Troubleshooting

### "Connection refused on port 5433"

```bash
docker-compose up -d postgres
docker-compose ps
```

### "Prisma datasource url is no longer supported"

Verificar archivos:
```bash
ls backend/prisma.config.js
ls backend/prisma/operational/prisma.config.js
ls backend/prisma/analytics/prisma.config.js
```

### "DATABASE_URL is required for seeding"

```bash
# Solución:
DATABASE_URL=postgresql://scraper:scraperpass@localhost:5433/scraperdb npx tsx prisma/seed.ts
```

### "Cannot find module '@web-scraping/contracts'"

```bash
pnpm build:contracts
# Reiniciar backend
```

### "Port already in use"

```bash
lsof -i :3000
kill -9 <PID>
```

---

## ✅ Checklist Final

- [ ] Node >= 20
- [ ] pnpm >= 9
- [ ] Docker installed
- [ ] `.env` exists
- [ ] `pnpm install` ✓
- [ ] PostgreSQL running
- [ ] Migrations applied
- [ ] Seed executed
- [ ] Prisma clients generated
- [ ] Contracts compiled
- [ ] Backend accessible: http://localhost:3000/api
- [ ] Frontend accessible: http://localhost:8080
- [ ] Login works: admin@example.com / adminpassword

---

## 🎉 ¡Proyecto Listo!

1. Accede a http://localhost:8080
2. Login con credenciales
3. Comienza a usar Visual Mapper
4. Mapea dominios
5. Extrae productos
6. Ve análisis en Dashboard

---

**Última actualización**: 2026-07-21  
**Versiones verificadas**:
- NestJS 11.0.1
- Angular 22.0.0
- Prisma 7.8.0
- Node 22.23.1
- pnpm 11.1.1
- Docker 27.x.x
