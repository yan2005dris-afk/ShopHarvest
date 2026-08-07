import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { PrismaClient, Prisma } from '../src/generated/operational';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required for seeding');
}
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'adminpassword';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    // The seed is the single deterministic source of administration: it both
    // creates the first operator and re-promotes an existing account on a
    // populated DB (whose migration defaulted every account to `user`).
    update: { role: 'admin' },
    create: {
      email,
      passwordHash,
      role: 'admin',
    },
  });

  console.log(`Default user seeded successfully.`);

  // ── Common categories ──────────────────────────────────────
  const categories = [
    {
      name: 'Ropa',
      description: 'Prendas de vestir, calzado y accesorios de moda.',
      defaultFieldMappings: [
        { canonicalField: 'title', selector: '', type: 'text' },
        { canonicalField: 'image', selector: '', type: 'image' },
        { canonicalField: 'price', selector: '', type: 'price' },
      ],
    },
    {
      name: 'Electrónica',
      description: 'Dispositivos electrónicos, computación, celulares y componentes.',
      defaultFieldMappings: [
        { canonicalField: 'title', selector: '', type: 'text' },
        { canonicalField: 'image', selector: '', type: 'image' },
        { canonicalField: 'price', selector: '', type: 'price' },
        { canonicalField: 'brand', selector: '', type: 'text' },
        { canonicalField: 'model', selector: '', type: 'text' },
      ],
    },
    {
      name: 'Supermercados',
      description: 'Alimentos, bebidas, limpieza e higiene personal.',
      defaultFieldMappings: [
        { canonicalField: 'title', selector: '', type: 'text' },
        { canonicalField: 'image', selector: '', type: 'image' },
        { canonicalField: 'price', selector: '', type: 'price' },
        { canonicalField: 'unit', selector: '', type: 'text' },
      ],
    },
    {
      name: 'Hogar',
      description: 'Muebles, decoración, herramientas y artículos para el hogar.',
      defaultFieldMappings: [
        { canonicalField: 'title', selector: '', type: 'text' },
        { canonicalField: 'image', selector: '', type: 'image' },
        { canonicalField: 'price', selector: '', type: 'price' },
      ],
    },
    {
      name: 'Deportes',
      description: 'Equipamiento deportivo, indumentaria y accesorios para actividades físicas.',
      defaultFieldMappings: [
        { canonicalField: 'title', selector: '', type: 'text' },
        { canonicalField: 'image', selector: '', type: 'image' },
        { canonicalField: 'price', selector: '', type: 'price' },
        { canonicalField: 'brand', selector: '', type: 'text' },
      ],
    },
    {
      name: 'Juguetes',
      description: 'Juguetes, juegos de mesa y entretenimiento infantil.',
      defaultFieldMappings: [
        { canonicalField: 'title', selector: '', type: 'text' },
        { canonicalField: 'image', selector: '', type: 'image' },
        { canonicalField: 'price', selector: '', type: 'price' },
      ],
    },
    {
      name: 'Belleza',
      description: 'Cosméticos, cuidado personal, perfumes y tratamientos.',
      defaultFieldMappings: [
        { canonicalField: 'title', selector: '', type: 'text' },
        { canonicalField: 'image', selector: '', type: 'image' },
        { canonicalField: 'price', selector: '', type: 'price' },
        { canonicalField: 'brand', selector: '', type: 'text' },
      ],
    },
    {
      name: 'Mascotas',
      description: 'Alimento, accesorios y productos para animales domésticos.',
      defaultFieldMappings: [
        { canonicalField: 'title', selector: '', type: 'text' },
        { canonicalField: 'image', selector: '', type: 'image' },
        { canonicalField: 'price', selector: '', type: 'price' },
        { canonicalField: 'unit', selector: '', type: 'text' },
      ],
    },
    {
      name: 'Libros',
      description: 'Libros físicos, digitales, revistas y material de lectura.',
      defaultFieldMappings: [
        { canonicalField: 'title', selector: '', type: 'text' },
        { canonicalField: 'image', selector: '', type: 'image' },
        { canonicalField: 'price', selector: '', type: 'price' },
        { canonicalField: 'author', selector: '', type: 'text' },
      ],
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {
        description: cat.description,
        defaultFieldMappings: cat.defaultFieldMappings as Prisma.InputJsonValue,
      },
      create: {
        name: cat.name,
        description: cat.description,
        defaultFieldMappings: cat.defaultFieldMappings as Prisma.InputJsonValue,
        path: '', // placeholder — root categories don't need a materialized path
      },
    });
  }

  console.log(`${categories.length} categories seeded successfully.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
