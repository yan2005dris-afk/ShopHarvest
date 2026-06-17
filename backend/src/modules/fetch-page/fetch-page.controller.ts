import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { FetchPageService } from './fetch-page.service';
import { CreateFetchRequestDto, FetchResultDto } from './dto';

@Controller('fetch-page')
export class FetchPageController {
  constructor(private readonly fetchPageService: FetchPageService) {}

  @Post()
  async create(@Body() dto: CreateFetchRequestDto) {
    try {
      return await this.fetchPageService.createFetchRequest(dto);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(message);
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      return await this.fetchPageService.getFetchRequest(id);
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
    @Body() dto: FetchResultDto,
  ) {
    try {
      return await this.fetchPageService.submitResult(id, dto);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('not found')) {
        throw new NotFoundException(message);
      }
      throw err;
    }
  }
}
