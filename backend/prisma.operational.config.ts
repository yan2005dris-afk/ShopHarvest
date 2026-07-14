import * as dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

// In dev (NODE_ENV !== 'production') load .env from the repo root via dotenv.
// In production the env vars are injected by docker-compose `env_file`/`environment`,
// so dotenv is skipped and `process.env.DATABASE_URL` comes from the container.
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '../.env' });
}

export default defineConfig({
  schema: 'prisma/operational/schema.prisma',
  migrations: {
    path: 'prisma/operational/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
