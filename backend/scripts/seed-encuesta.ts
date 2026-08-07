import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/analytics';

const connectionString = process.env.ANALYTICS_DATABASE_URL;
if (!connectionString) {
  throw new Error('ANALYTICS_DATABASE_URL is required for seeding');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/**
 * Sample data generators for realistic test data.
 * Base values are inspired by e-commerce behavior patterns.
 */
const GENEROS = ['Masculino', 'Femenino', 'Otro'];

const SITIOS = ['mercadolibre', 'aliexpress', 'temu', 'shein'];

const FRECUENCIAS = [
  'Semanal',
  'Quincenal',
  'Mensual',
  'Trimestral',
  'Ocasional',
];

const GASTOS = [
  '$10-$50',
  '$50-$100',
  '$100-$250',
  '$250-$500',
  '$500+',
];

interface EncuestaRecord {
  id_genero: number;
  id_sitio_preferido: number;
  edad?: number;
  frecuencia_compra: string;
  gasto_promedio_mensual: string;
  motivo_compra?: string;
}

async function getOrCreateDimensions() {
  // Get all géneros
  const generos = await prisma.$queryRawUnsafe<
    { id_genero: number; nombre_genero: string }[]
  >(`SELECT id_genero, nombre_genero FROM dw.dim_genero`);

  // Get all fuentes (sitios)
  const fuentes = await prisma.$queryRawUnsafe<
    { id_fuente: number; nombre_fuente: string }[]
  >(`SELECT id_fuente, nombre_fuente FROM dw.dim_fuente`);

  console.log(`Found ${generos.length} géneros:`, generos);
  console.log(`Found ${fuentes.length} fuentes:`, fuentes);

  // If no géneros exist, create them
  if (generos.length === 0) {
    for (const genero of GENEROS) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO dw.dim_genero (nombre_genero) VALUES ($1) ON CONFLICT DO NOTHING`,
        genero,
      );
    }
    const newGeneros = await prisma.$queryRawUnsafe<
      { id_genero: number }[]
    >(`SELECT id_genero FROM dw.dim_genero`);
    return { generos: newGeneros.map((g) => g.id_genero), fuentes };
  }

  // If no fuentes exist, create them
  if (fuentes.length === 0) {
    for (const sitio of SITIOS) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO dw.dim_fuente (nombre_fuente, tipo_fuente) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        sitio,
        'marketplace',
      );
    }
    const newFuentes = await prisma.$queryRawUnsafe<
      { id_fuente: number }[]
    >(`SELECT id_fuente FROM dw.dim_fuente`);
    return { generos: generos.map((g) => g.id_genero), fuentes: newFuentes.map((f) => f.id_fuente) };
  }

  return {
    generos: generos.map((g) => g.id_genero),
    fuentes: fuentes.map((f) => f.id_fuente),
  };
}

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomAge(): number {
  return Math.floor(Math.random() * (65 - 18 + 1)) + 18;
}

async function seedEncuestaData(
  generoIds: number[],
  fuenteIds: number[],
) {
  const records: EncuestaRecord[] = [];

  // Generate 50 records with realistic distribution
  for (let i = 0; i < 50; i++) {
    records.push({
      id_genero: getRandomElement(generoIds),
      id_sitio_preferido: getRandomElement(fuenteIds),
      edad: getRandomAge(),
      frecuencia_compra: getRandomElement(FRECUENCIAS),
      gasto_promedio_mensual: getRandomElement(GASTOS),
      motivo_compra: getRandomElement([
        'Ropa y accesorios',
        'Electrónica',
        'Hogar y decoración',
        'Cosméticos y belleza',
        'Deporte y fitness',
        'Entretenimiento',
      ]),
    });
  }

  // Insert records
  console.log(`\nInserting ${records.length} encuesta records...`);

  let inserted = 0;
  for (const record of records) {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO dw.fact_encuesta_consumo (
          id_genero,
          id_sitio_preferido,
          edad,
          frecuencia_compra,
          gasto_promedio_mensual,
          motivo_compra
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        record.id_genero,
        record.id_sitio_preferido,
        record.edad || null,
        record.frecuencia_compra,
        record.gasto_promedio_mensual,
        record.motivo_compra || null,
      );
      inserted++;
    } catch (error) {
      console.error(`Error inserting record:`, error);
    }
  }

  console.log(`✓ Successfully inserted ${inserted}/${records.length} records`);
  return inserted;
}

async function main() {
  try {
    console.log('Starting encuesta seeding...\n');

    // Get or create dimensions
    const { generos, fuentes } = await getOrCreateDimensions();

    if (generos.length === 0) {
      throw new Error(
        'No géneros found. Please ensure dim_genero is populated.',
      );
    }
    if (fuentes.length === 0) {
      throw new Error(
        'No fuentes found. Please ensure dim_fuente is populated.',
      );
    }

    // Insert sample data
    const inserted = await seedEncuestaData(generos, fuentes);

    // Verify
    const count = await prisma.$queryRawUnsafe<
      [{ total: bigint }]
    >(`SELECT COUNT(*) as total FROM dw.fact_encuesta_consumo`);

    console.log(`\n✓ Total encuesta records in database: ${count[0].total}`);

    console.log(`\n✓ Seeding completed successfully!`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
