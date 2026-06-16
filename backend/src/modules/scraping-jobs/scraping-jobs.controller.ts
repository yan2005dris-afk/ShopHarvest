import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ScrapingJobsService } from './scraping-jobs.service';

@Controller('scraping-jobs')
export class ScrapingJobsController {
  constructor(
    private readonly scrapingJobsService: ScrapingJobsService,
  ) {}

  @Post()
  async enqueue(
    @Body() body: { domainRuleId: string; url?: string },
  ) {
    return this.scrapingJobsService.enqueueJob(
      body.domainRuleId,
      body.url,
    );
  }

  @Get('status')
  async status() {
    return this.scrapingJobsService.getQueueStatus();
  }
}
