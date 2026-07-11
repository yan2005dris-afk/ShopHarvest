-- fix-analytics-db-wiring Stage 2: the `dw` schema on the OPERATIONAL
-- Postgres instance is a dead duplicate. The analytics service (Analytics
-- PrismaService, dw-loader.service.ts, etl-scheduler.service.ts) was
-- rewired to the physically separate `postgres-dw` instance in
-- fix-analytics-db-wiring (PR #17/#19); this instance's copy has been
-- unused since then (confirmed empty at drop time). Drop it entirely.

DROP SCHEMA IF EXISTS "dw" CASCADE;
