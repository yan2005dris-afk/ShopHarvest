import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ScrapingJobsService } from './scraping-jobs.service';
import { CreateScrapingJobDto, SubmitResultDto } from './dto';

@Controller('scraping-jobs')
export class ScrapingJobsController {
  constructor(
    private readonly scrapingJobsService: ScrapingJobsService,
  ) {}

  @Post()
  async enqueue(@Body() body: CreateScrapingJobDto) {
    try {
      const job = await this.scrapingJobsService.enqueueJob(
        body.domainRuleId,
        body.url,
      );
      return job;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('not found')) {
        throw new NotFoundException(message);
      }
      throw err;
    }
  }

  @Post(':id/result')
  @HttpCode(200)
  async submitResult(
    @Param('id') id: string,
    @Body() body: SubmitResultDto,
  ) {
    try {
      const result = await this.scrapingJobsService.submitResult(id, body);
      if (result === null) {
        throw new NotFoundException(`ScrapingJob with id ${id} not found`);
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'Job already completed') {
        throw new ConflictException(message);
      }
      throw err;
    }
  }

  @Get()
  async findAll(
    @Query('status') status?: string,
    @Query('domainRuleId') domainRuleId?: string,
  ) {
    return this.scrapingJobsService.findAll(status, domainRuleId);
  }

  @Get('failed')
  async findFailed() {
    return this.scrapingJobsService.findFailed();
  }

  @Get('status')
  async status() {
    return this.scrapingJobsService.getQueueStatus();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const job = await this.scrapingJobsService.findOne(id);
    if (!job) {
      throw new NotFoundException(`ScrapingJob with id ${id} not found`);
    }
    return job;
  }

  @Get(':id/result')
  async findResult(@Param('id') id: string) {
    const result = await this.scrapingJobsService.findResult(id);
    if (result === undefined || result === null) {
      throw new NotFoundException(`ScrapingJob with id ${id} not found or has no result`);
    }
    return result;
  }
}
