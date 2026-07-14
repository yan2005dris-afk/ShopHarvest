import * as dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// In dev load .env from repo root; in production env vars come from docker-compose.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '../.env' });
}

export default defineConfig({
  schema: 'prisma/analytics/schema.prisma',
  migrations: {
    path: 'prisma/analytics/migrations',
  },
  datasource: {
    url: process.env.ANALYTICS_DATABASE_URL,
  },
});
