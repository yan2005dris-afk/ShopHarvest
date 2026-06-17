import { Module } from '@nestjs/common';
import { ScrapingJobsController } from './scraping-jobs.controller';
import { ScrapeListingController } from './scrape-listing.controller';
import { ScrapingJobsService } from './scraping-jobs.service';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [ProductsModule],
  controllers: [ScrapingJobsController, ScrapeListingController],
  providers: [ScrapingJobsService],
  exports: [ScrapingJobsService],
})
export class ScrapingJobsModule {}
