import { Module } from '@nestjs/common';
import { ScrapingJobsController } from './scraping-jobs.controller';
import { ScrapingJobsService } from './scraping-jobs.service';

@Module({
  controllers: [ScrapingJobsController],
  providers: [ScrapingJobsService],
  exports: [ScrapingJobsService],
})
export class ScrapingJobsModule {}
