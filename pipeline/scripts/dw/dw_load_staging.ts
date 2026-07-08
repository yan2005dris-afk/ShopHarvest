// ============================================================
// Carga ETL: Staging → Data Warehouse
// Entregable 4: Data Warehouse y Analítica
// Lee archivos JSON de staging/ y carga en esquema dw
// Ejecución: npx ts-node scripts/dw/dw_load_staging.ts
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 requiere driver adapter; pasamos DATABASE_URL al adapter pg.
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// ── Logging ──────────────────────────────────────────────
function log(msg: string) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

// ── Dimensiones de referencia ────────────────────────────

const FUENTES = [
    { nombre: 'mercadolibre', tipo: 'scraping', desc: 'MercadoLibre Ecuador - Scraping Playwright' },
    { nombre: 'aliexpress',   tipo: 'scraping', desc: 'AliExpress (books.toscrape.com) - Scraping Playwright' },
    { nombre: 'temu',         tipo: 'scraping', desc: 'Temu - Extracción vía Extensión Chrome' },
    { nombre: 'shein',        tipo: 'scraping', desc: 'Shein - Extracción vía Extensión Chrome' },
    { nombre: 'archivos',     tipo: 'archivo',  desc: 'Dataset Kaggle E-Commerce - Archivo CSV estructurado' },
];

const CATEGORIAS = [
    { nombre: 'electronica', desc: 'Dispositivos electrónicos, computación y accesorios tecnológicos' },
    { nombre: 'hogar',       desc: 'Productos para el hogar, cocina y decoración' },
    { nombre: 'moda',        desc: 'Ropa, calzado y accesorios de moda' },
    { nombre: 'ropa',        desc: 'Prendas de vestir en general' },
    { nombre: 'belleza',     desc: 'Cosméticos, cuidado personal y perfumería' },
    { nombre: 'juguetes',    desc: 'Juguetes, juegos y entretenimiento' },
    { nombre: 'deportes',    desc: 'Artículos deportivos y fitness' },
    { nombre: 'otros',       desc: 'Productos sin clasificación específica' },
];

const MONEDAS = [
    { codigo: 'USD', nombre: 'Dólar estadounidense', simbolo: '$' },
    { codigo: 'GBP', nombre: 'Libra esterlina',      simbolo: '£' },
    { codigo: 'EUR', nombre: 'Euro',                 simbolo: '€' },
];

const CALIFICACIONES = [
    { nivel: 'One',   valor: 1 },
    { nivel: 'Two',   valor: 2 },
    { nivel: 'Three', valor: 3 },
    { nivel: 'Four',  valor: 4 },
    { nivel: 'Five',  valor: 5 },
];

const GENEROS = [
    { nombre: 'Masculino', abrev: 'M' },
    { nombre: 'Femenino',  abrev: 'F' },
];

const NOMBRES_MES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// ── Helpers ──────────────────────────────────────────────

async function ensureDim(table: string, insertSql: string, values: any[]) {
    try {
        await prisma.$executeRawUnsafe(insertSql, ...values);
    } catch (err: any) {
        // Ignore duplicate key errors (ON CONFLICT DO NOTHING)
        if (!err.message?.includes('violates unique constraint')) {
            throw err;
        }
    }
}

async function getDimId(table: string, whereCol: string, whereVal: any): Promise<number | null> {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT id_${table.replace('dw.dim_', '')} AS id FROM ${table} WHERE ${whereCol} = $1 LIMIT 1`,
        whereVal
    );
    return rows[0]?.id ?? null;
}

// ── Carga de Dimensiones ─────────────────────────────────

async function loadDimFuente() {
    log('Cargando DimFuente...');
    for (const f of FUENTES) {
        await ensureDim('dw.dim_fuente',
            `INSERT INTO dw.dim_fuente (nombre_fuente, tipo_fuente, descripcion)
             VALUES ($1, $2, $3) ON CONFLICT (nombre_fuente) DO NOTHING`,
            [f.nombre, f.tipo, f.desc]
        );
    }
    log(`  ${FUENTES.length} fuentes cargadas`);
}

async function loadDimCategoria() {
    log('Cargando DimCategoria...');
    for (const c of CATEGORIAS) {
        await ensureDim('dw.dim_categoria',
            `INSERT INTO dw.dim_categoria (nombre_categoria, descripcion)
             VALUES ($1, $2) ON CONFLICT (nombre_categoria) DO NOTHING`,
            [c.nombre, c.desc]
        );
    }
    log(`  ${CATEGORIAS.length} categorías cargadas`);
}

async function loadDimMoneda() {
    log('Cargando DimMoneda...');
    for (const m of MONEDAS) {
        await ensureDim('dw.dim_moneda',
            `INSERT INTO dw.dim_moneda (codigo_moneda, nombre_moneda, simbolo)
             VALUES ($1, $2, $3) ON CONFLICT (codigo_moneda) DO NOTHING`,
            [m.codigo, m.nombre, m.simbolo]
        );
    }
    log(`  ${MONEDAS.length} monedas cargadas`);
}

async function loadDimCalificacion() {
    log('Cargando DimCalificacion...');
    for (const c of CALIFICACIONES) {
        await ensureDim('dw.dim_calificacion',
            `INSERT INTO dw.dim_calificacion (nivel, valor_numerico)
             VALUES ($1, $2) ON CONFLICT (nivel) DO NOTHING`,
            [c.nivel, c.valor]
        );
    }
    log(`  ${CALIFICACIONES.length} niveles cargados`);
}

async function loadDimGenero() {
    log('Cargando DimGenero...');
    for (const g of GENEROS) {
        await ensureDim('dw.dim_genero',
            `INSERT INTO dw.dim_genero (nombre_genero, abreviatura)
             VALUES ($1, $2) ON CONFLICT (nombre_genero) DO NOTHING`,
            [g.nombre, g.abrev]
        );
    }
    log(`  ${GENEROS.length} géneros cargados`);
}

async function loadDimTiempo(fechas: Set<string>) {
    log('Cargando DimTiempo...');
    let count = 0;
    for (const f of fechas) {
        if (!f) continue;
        const d = new Date(f);
        if (isNaN(d.getTime())) continue;
        const anio = d.getFullYear();
        const mes = d.getMonth() + 1;
        const dia = d.getDate();
        const trim = Math.ceil(mes / 3);
        await ensureDim('dw.dim_tiempo',
            `INSERT INTO dw.dim_tiempo (fecha_completa, anio, mes, dia, trimestre, nombre_mes)
             VALUES ($1::date, $2, $3, $4, $5, $6) ON CONFLICT (fecha_completa) DO NOTHING`,
            [f, anio, mes, dia, trim, NOMBRES_MES[mes - 1]]
        );
        count++;
    }
    log(`  ${count} fechas cargadas`);
}

// ── Carga de Hechos ──────────────────────────────────────

async function loadFactProductos() {
    log('Cargando FactProductos...');
    const filePath = path.join(__dirname, '../../staging/all_products_clean.json');
    const data: any[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    log(`  Leídos ${data.length} registros de staging`);

    let inserted = 0;
    let skipped = 0;

    for (const item of data) {
        if (!item.titulo_oferta) {
            skipped++;
            continue;
        }

        // Insertar o recuperar producto
        let idProducto: number | null = null;

        // Try inserting
        try {
            const result = await prisma.$queryRawUnsafe<Array<{ id_producto: number }>>(
                `INSERT INTO dw.dim_producto (titulo_oferta, url_producto, disponibilidad)
                 VALUES ($1, $2, $3)
                 RETURNING id_producto`,
                item.titulo_oferta, item.url_producto ?? null, item.disponibilidad ?? null
            );
            idProducto = result[0]?.id_producto ?? null;
        } catch {
            // Producto ya existe — obtener ID
            idProducto = await getDimId('dw.dim_producto', 'titulo_oferta', item.titulo_oferta);
        }

        if (!idProducto) {
            skipped++;
            continue;
        }

        // Resolver IDs de dimensiones
        const nombreFuente = (item._fuente || 'archivos').toLowerCase();
        const nombreCategoria = (item.categoria_normalizada || item._categoria || 'otros').toLowerCase();
        const codigoMoneda = (item.moneda || 'USD').toUpperCase();
        const fechaStr = item._extraido_en || '2026-06-30';
        const nivelCalif = item.calificacion || null;

        const idFuente = await getDimId('dw.dim_fuente', 'nombre_fuente', nombreFuente);
        const idCategoria = await getDimId('dw.dim_categoria', 'nombre_categoria', nombreCategoria);
        const idTiempo = await getDimId('dw.dim_tiempo', 'fecha_completa::text', fechaStr);
        const idMoneda = await getDimId('dw.dim_moneda', 'codigo_moneda', codigoMoneda);

        if (!idFuente || !idCategoria || !idTiempo || !idMoneda) {
            skipped++;
            continue;
        }

        let idCalificacion: number | null = null;
        if (nivelCalif) {
            idCalificacion = await getDimId('dw.dim_calificacion', 'nivel', nivelCalif);
        }

        // Insertar hecho
        try {
            await prisma.$executeRawUnsafe(
                `INSERT INTO dw.fact_productos
                 (id_producto, id_fuente, id_categoria, id_tiempo, id_moneda, id_calificacion, precio_usd, precio_raw, disponibilidad)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                idProducto, idFuente, idCategoria, idTiempo, idMoneda,
                idCalificacion,
                item.precio_usd ?? null,
                item.precio_raw ? String(item.precio_raw) : null,
                item.disponibilidad ?? null
            );
            inserted++;
        } catch (err: any) {
            log(`  Error insertando hecho: ${err.message?.slice(0, 100)}`);
            skipped++;
        }
    }

    log(`  Insertados: ${inserted} | Omitidos: ${skipped}`);
    return inserted;
}

async function loadFactEncuesta() {
    log('Cargando FactEncuestaConsumo...');
    const filePath = path.join(__dirname, '../../staging/stg_encuesta_clean.json');
    const data: any[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    log(`  Leídos ${data.length} registros de encuesta`);

    // Mapa de nombres de sitios a nombre_fuente en DimFuente
    const sitioMap: Record<string, string> = {
        'MercadoLibre': 'mercadolibre',
        'AliExpress': 'aliexpress',
        'Temu': 'temu',
        'Shein': 'shein',
    };

    let inserted = 0;
    let skipped = 0;

    for (const item of data) {
        const idGenero = await getDimId('dw.dim_genero', 'nombre_genero', item.genero || 'Masculino');
        const nombreSitio = sitioMap[item.sitio_preferido] || 'archivos';
        const idSitio = await getDimId('dw.dim_fuente', 'nombre_fuente', nombreSitio);

        if (!idGenero || !idSitio) {
            skipped++;
            continue;
        }

        try {
            await prisma.$executeRawUnsafe(
                `INSERT INTO dw.fact_encuesta_consumo
                 (id_genero, id_sitio_preferido, edad, frecuencia_compra, gasto_promedio_mensual, motivo_compra)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                idGenero, idSitio,
                item.edad ? parseInt(item.edad) : null,
                item.frecuencia_compra || null,
                item.gasto_promedio_mensual || null,
                item.motivo_compra || null
            );
            inserted++;
        } catch (err: any) {
            log(`  Error insertando encuesta: ${err.message?.slice(0, 100)}`);
            skipped++;
        }
    }

    log(`  Insertados: ${inserted} | Omitidos: ${skipped}`);
    return inserted;
}

// ── Main ──────────────────────────────────────────────────

async function main() {
    log('═══════════════════════════════════════════');
    log('CARGA DEL DATA WAREHOUSE - Entregable 4');
    log('═══════════════════════════════════════════');

    log('\n📦 Cargando dimensiones...');
    await loadDimFuente();
    await loadDimCategoria();
    await loadDimMoneda();
    await loadDimCalificacion();
    await loadDimGenero();

    // Extraer fechas únicas de los datos de staging
    const productos: any[] = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../../staging/all_products_clean.json'), 'utf-8')
    );
    const fechas = new Set(productos.map((p: any) => p._extraido_en).filter(Boolean));
    await loadDimTiempo(fechas);

    log('\n📊 Cargando tablas de hechos...');
    const prodCount = await loadFactProductos();
    const encCount = await loadFactEncuesta();

    log('\n═══════════════════════════════════════════');
    log('RESUMEN DE CARGA');
    log('═══════════════════════════════════════════');
    log(`  Productos cargados en FactProductos: ${prodCount}`);
    log(`  Encuestas cargadas en FactEncuesta:  ${encCount}`);
    log('═══════════════════════════════════════════');
    log('✅ Carga completada exitosamente.');
}

main()
    .catch((err) => {
        console.error('❌ Error durante la carga del DW:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
