import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { DomainsModule } from './modules/domains/domains.module';
import { ProductsModule } from './modules/products/products.module';
import { ScrapingJobsModule } from './modules/scraping-jobs/scraping-jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../.env',
    }),
    PrismaModule,
    DomainsModule,
    ProductsModule,
    ScrapingJobsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
