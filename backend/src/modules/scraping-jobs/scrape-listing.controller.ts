import {
  Controller,
  Post,
  Body,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ScrapingJobsService } from './scraping-jobs.service';
import { ScrapeListingDto } from './dto/scrape-listing.dto';

@Controller('scrape-listing')
export class ScrapeListingController {
  constructor(
    private readonly scrapingJobsService: ScrapingJobsService,
  ) {}

  @Post()
  async create(@Body() dto: ScrapeListingDto) {
    try {
      return await this.scrapingJobsService.enqueueListing(dto);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('not found') || message.includes('No DomainRule')) {
        throw new NotFoundException(message);
      }
      if (message.includes('no fieldMappings') || message.includes('no containerSelector')) {
        throw new BadRequestException(message);
      }
      throw err;
    }
  }
}
