import { defineConfig } from 'prisma/config';
import dotenv from 'dotenv';

// Prisma 7 does not load .env automatically
dotenv.config({ path: '.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
