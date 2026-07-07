import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const allowed = ['http://localhost:8080', 'http://localhost:4200'];
      if (
        !origin ||
        allowed.includes(origin) ||
        /^(moz|chrome)-extension:\/\//.test(origin)
      ) {
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

  // Slice 3 / Spec 3 REQ-SW-3, REQ-SW-4: Swagger UI is gated on
  // NODE_ENV !== 'production'. In production, /api/docs and
  // /api/docs-json are not registered, so any request there returns 404
  // (verified by the e2e suite).
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('WebScrapingDinamico API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .addTag('Auth', 'User registration and login')
      .addTag('Domains', 'Per-domain scraping rules')
      .addTag('Products', 'Extracted product catalog and price history')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
