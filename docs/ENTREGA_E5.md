# Entrega Entregable 5 — Dashboard Funcional y Reporte

**Asignatura:** VI Inteligencia de Negocios · Ingeniería de Software
**Institución:** UPSE
**Plazo:** Martes 14 de julio de 2026

---

## ✅ Lo que está HECHO y commiteado

| Pieza | Ubicación | Estado |
|-------|-----------|--------|
| Dashboard Angular 22 con 7 KPI cards + 3 familias de gráficos | `frontend/src/app/pages/dashboard/` | ✅ Compila (`pnpm build` exit 0) · 45/45 tests |
| Backend `AnalyticsModule` con 12 endpoints REST | `backend/src/modules/analytics/` | ✅ 117/117 tests verdes |
| Backend `PipelineModule` con Ports & Adapters | `backend/src/modules/pipeline/` | ✅ Adapters consumen interfaces en `contracts/pipeline/` |
| DW cargado en BD local | PostgreSQL `scraperdb`, esquema `dw` | ✅ 164 productos + 24 encuestas |
| Plan estratégico completo | `docs/PLAN_Entregable5_Dashboard_Reporte.md` | ✅ |
| Reporte académico Parte B | `docs/Reporte_Entregable5.md` | ✅ 10 secciones, 12 referencias |
| Bug pre-existente E4 (`ROUND(AVG(...))`) arreglado | `backend/pipeline/scripts/dw/dw_*.sql` | ✅ |

**8 commits atómicos en rama `feat/bi-dashboard-analytics`:**

```
1107d91 feat(frontend): dashboard BI Angular con ng-apexcharts y lectura del DW
8d011c8 fix(infra): docker build contracts + workspace allowBuilds
acef878 refactor(backend): pipeline ETL con Ports & Adapters — interfaces + modulo NestJS
e3eba2c feat(backend): AnalyticsModule para dashboard BI con lecturas del DW
ed4b2f6 feat(backend): integrar modelos DW en Prisma con multi-schema
5098e1d refactor(backend): integrar ETL pipeline en backend/pipeline/
92541d3 fix(pipeline): cast ::numeric en ROUND() y PrismaPg adapter para Prisma 7
```

---

## ❌ Lo que TENÉS que hacer vos (con tu tiempo y tus cuentas)

### 1. Conseguir la plantilla UPSE oficial (BLOQUEANTE)

- Pedir al docente (`apachay@upse.edu.ec` o el del aula virtual) el `.docx` o `.pdf` oficial.
- En `docs/Reporte_Entregable5.md`, reemplazar el placeholder `[ INSERTAR PORTADA OFICIAL UPSE ]` con la portada oficial.
- Convertir el `.md` a `.pdf` con pandoc o Word.

### 2. Deploy público del dashboard (RECOMENDADO por rúbrica)

| Servicio | Proveedor | Plan | Costo |
|----------|-----------|------|-------|
| Base de datos | [Neon](https://neon.tech) | Free tier (0.5 GB, sin sleep) | $0 |
| Backend | [Render](https://render.com) | Free (sleep 15 min, primer hit ~30s) | $0 |
| Frontend | [Vercel](https://vercel.com) | Free | $0 |

**Pasos rápidos:**

1. **Neon** — Crear proyecto, copiar `DATABASE_URL` con SSL.
2. **Restaurar DW en Neon:**
   ```bash
   docker exec scraper-postgres pg_dump -U scraper -d scraperdb --schema=dw --no-owner > dw_backup.sql
   psql "postgresql://USER:PASS@HOST.neon.tech/dbname?sslmode=require" -c "CREATE SCHEMA IF NOT EXISTS dw;"
   psql "postgresql://USER:PASS@HOST.neon.tech/dbname?sslmode=require" -f dw_backup.sql
   psql "..." -c "REFRESH MATERIALIZED VIEW dw.mv_resumen_precios;"
   ```
3. **Render** — Conectar repo, build command: `pnpm install && pnpm --filter @web-scraping/contracts build && pnpm --filter backend build`, start: `node backend/dist/main.js`, env var `DATABASE_URL=...` de Neon.
4. **Vercel** — Conectar repo, root: `frontend`, build: `pnpm build`, output: `dist/webscraper`. El `proxy.conf.json` no se usa en prod — la URL del backend hay que pasarla al frontend via env var `API_BASE_URL` y adaptar `frontend/src/environments/environment.ts`.
5. **CORS** — El backend ya está configurado con `FRONTEND_ORIGIN` env var. Configurar en Render con el dominio de Vercel.

### 3. Video demostrativo (3-5 minutos)

- Capturar recorrido del dashboard: filtros, cambios reactivos, hover sobre charts.
- Herramientas: **OBS Studio** (gratis, local) o **Loom** (nube).
- Subir a YouTube (unlisted) o entregar como MP4 adjunto.

### 4. Conversión del reporte a PDF

```bash
# Opción 1: pandoc + LaTeX
pandoc docs/Reporte_Entregable5.md -o Reporte_Entregable5.pdf --pdf-engine=xelatex

# Opción 2: LibreOffice (más fácil)
libreoffice --headless --convert-to pdf docs/Reporte_Entregable5.md
```

### 5. Submit final

Subir a la plataforma UPSE **antes del martes 14 de julio a las 23:59**:
- URL pública del dashboard (si se desplegó)
- PDF del reporte (con plantilla UPSE oficial)
- Video demostrativo (link YouTube o MP4)

---

## 🛟 Plan B si algo falla

Si la URL pública no responde al momento de la calificación, el reporte PDF incluye:

- **Anexo F** con instrucciones paso a paso para clonar el repo, levantar Docker, cargar DW, arrancar backend, abrir dashboard localmente.
- Capturas de pantalla en el reporte (si decidís agregarlas).
- Video demostrativo offline adjunto.

---

## 📋 Checklist pre-entrega

- [ ] Plantilla UPSE insertada en `docs/Reporte_Entregable5.md`
- [ ] Reporte convertido a PDF
- [ ] Deploy público funcional (URL + screenshot)
- [ ] Video demostrativo subido o adjunto
- [ ] URL del backend con Swagger UI (`/api/docs`) verificada
- [ ] URL del dashboard verificada con un usuario anónimo
- [ ] README de entrega actualizado con URLs finales
- [ ] Submit en plataforma UPSE

---

## 📞 Comandos rápidos de respaldo

### Levantar todo localmente (si deploy falla)

```bash
# Levantar Postgres
docker compose up -d postgres

# Cargar DW (si está vacío)
docker exec -i scraper-postgres psql -U scraper -d scraperdb < backend/pipeline/scripts/dw/dw_schema.sql
docker exec -i scraper-postgres psql -U scraper -d scraperdb < backend/pipeline/scripts/dw/dw_analytical_queries.sql
docker exec scraper-postgres psql -U scraper -d scraperdb -c "REFRESH MATERIALIZED VIEW dw.mv_resumen_precios;"
cd backend/pipeline && DATABASE_URL=postgresql://scraper:scraperpass@localhost:5433/scraperdb npx ts-node scripts/dw/dw_load_staging.ts --truncate

# Backend
cd ../.. && cd backend
DATABASE_URL=postgresql://scraper:scraperpass@localhost:5433/scraperdb pnpm start:dev
# → http://localhost:3000/api/docs (Swagger UI)

# Frontend (en otra terminal)
cd ..
pnpm dev:frontend
# → http://localhost:4200/dashboard
```

### Verificar salud del DW

```bash
docker exec scraper-postgres psql -U scraper -d scraperdb -c "
SELECT 'dim_producto' AS tabla, COUNT(*) FROM dw.dim_producto
UNION ALL SELECT 'fact_productos', COUNT(*) FROM dw.fact_productos
UNION ALL SELECT 'fact_encuesta_consumo', COUNT(*) FROM dw.fact_encuesta_consumo;
"
```

### Verificar backend (cuando esté corriendo)

```bash
curl http://localhost:3000/api/analytics/summary | jq
curl http://localhost:3000/api/analytics/kpis | jq '.distribucion_fuentes'
```

---

*Documento de entrega — Entregable 5 BI · UPSE · Julio 2026*