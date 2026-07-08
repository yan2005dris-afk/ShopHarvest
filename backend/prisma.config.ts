import * as dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '../.env' });
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
