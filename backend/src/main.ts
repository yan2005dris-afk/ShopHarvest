import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * --smoke-run: arranca la app, resuelve todos los providers (grafo
 * de DI + lifecycle hooks) y sale con código 0 sin abrir un puerto
 * real ni disparar el tick del cron de ETL. Lo usa CI para detectar
 * regresiones de cableado de DI sin necesidad de un listener vivo.
 *
 * ¿Por qué existe este flag? En CI se necesita validar que la
 * aplicación "anda" antes de gastar 30+ segundos levantándola de
 * verdad (con Postgres, Redis y un puerto). Los tests unit cubren
 * lógica puntual pero no garantizan que todo el grafo de providers
 * cablea y que los `onModuleInit` corren sin reventar.
 *
 * NestJS 11 ya no emite la línea "bootstrapped" que sí tenían las
 * versiones viejas, por eso logueamos nuestra propia confirmación.
 */
const SMOKE_RUN = process.argv.includes('--smoke-run');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefijo global de rutas `/api`. Ningún controller embebe `api/` en su
  // propio `@Controller('…')` decorator; este setGlobalPrefix es el único
  // punto del sistema que materializa el prefijo. La superficie de
  // analytics quedó documentada como `/api/analytics/*` en
  // docs/PLAN_Entregable5_Dashboard_Reporte.md §2.2 y este prefijo la cumple.
  app.setGlobalPrefix('api');

  // Lista blanca CORS: orígenes de dev local + el frontend de producción +
  // los orígenes de extensión explícitamente configurados. NO se acepta un
  // wildcard de extensiones (`chrome-extension://*`): una extensión maliciosa
  // instalada en el navegador de un usuario no debe tener CORS hacia esta API
  // salvo que su origen figure en EXTENSION_ORIGINS.
  const frontendOrigins = (
    process.env.FRONTEND_ORIGIN ?? 'http://localhost:4200'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const extensionOrigins = (process.env.EXTENSION_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowed = [...frontendOrigins, ...extensionOrigins];
      // `!origin` (requests sin header Origin: curl, tools, same-origin) se
      // acepta; el auth sigue siendo Bearer token, no cookies, así que esto no
      // abre una vía cross-origin en navegadores (que siempre envían Origin).
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger UI

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('WebScrapingDinamico API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('Auth', 'User registration and login')
      .addTag('Domains', 'Per-domain scraping rules')
      .addTag('Products', 'Extracted product catalog and price history')
      .addTag(
        'Analytics',
        'BI dashboard endpoints backed by dw.v_kpi_* views and analytical queries (public).',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  if (SMOKE_RUN) {
    await app.init();
    new Logger('Bootstrap').log(
      'Nest application successfully bootstrapped (smoke-run)',
    );
    await app.close();
    process.exit(0);
    return;
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
