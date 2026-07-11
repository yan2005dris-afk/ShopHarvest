import * as dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '../.env' });
}

export default defineConfig({
  schema: 'prisma/operational/schema.prisma',
  migrations: {
    path: 'prisma/operational/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
