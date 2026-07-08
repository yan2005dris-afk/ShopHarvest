# Data Warehouse — Entregable 4

## Scripts disponibles

| Archivo | Propósito | Cómo ejecutar |
|---------|-----------|--------------|
| `dw_schema.sql` | DDL del modelo estrella (crear tablas, índices, vista materializada) | `psql -h localhost -p 5433 -U scraper -d scraperdb -f dw_schema.sql` |
| `dw_load_staging.ts` | Carga ETL desde staging JSON al DW | `cd ../.. && npx ts-node scripts/dw/dw_load_staging.ts` |
| `dw_analytical_queries.sql` | Consultas analíticas + KPIs + vistas | `psql -h localhost -p 5433 -U scraper -d scraperdb -f dw_analytical_queries.sql` |

## Orden de ejecución

```bash
# 1. Crear esquema y tablas del DW
psql -h localhost -p 5433 -U scraper -d scraperdb -f pipeline/scripts/dw/dw_schema.sql

# 2. Cargar datos desde staging
cd pipeline && npx ts-node scripts/dw/dw_load_staging.ts

# 3. Crear vistas analíticas y KPIs
psql -h localhost -p 5433 -U scraper -d scraperdb -f pipeline/scripts/dw/dw_analytical_queries.sql

# 4. Generar dump para entrega
pg_dump -h localhost -p 5433 -U scraper -d scraperdb --schema=dw --no-owner > pipeline/scripts/dw/dw_dump.sql
```

## Conexión

- **Host:** localhost
- **Puerto:** 5433
- **Base de datos:** scraperdb
- **Usuario:** scraper
- **Esquema DW:** dw
