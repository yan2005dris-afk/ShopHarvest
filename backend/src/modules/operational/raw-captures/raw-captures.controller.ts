import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import {
  IngestRawCaptureDto,
  RawCaptureResponseDto,
} from '@web-scraping/contracts/raw-captures';
import { RawCapturesService } from './raw-captures.service';

@ApiTags('RawCaptures')
@Controller('raw-captures')
export class RawCapturesController {
  constructor(private readonly rawCapturesService: RawCapturesService) {}

  private toDto<T extends object, V>(cls: new () => T, row: V): T {
    return plainToInstance(cls, row, { excludeExtraneousValues: true });
  }

  @ApiOperation({ summary: 'Ingest or upsert a raw capture' })
  @ApiResponse({ status: 201, type: RawCaptureResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Source not found' })
  @Post()
  async upsert(@Body() dto: IngestRawCaptureDto) {
    const row = await this.rawCapturesService.upsert(dto);
    return this.toDto(RawCaptureResponseDto, row);
  }

  @ApiOperation({ summary: 'List raw captures (optionally filtered by sourceId)' })
  @ApiQuery({ name: 'sourceId', required: false, type: String })
  @ApiResponse({ status: 200, type: RawCaptureResponseDto, isArray: true })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @Get()
  async findAll(@Query('sourceId') sourceId?: string) {
    const rows = await this.rawCapturesService.findAll(sourceId);
    return rows.map((row) => this.toDto(RawCaptureResponseDto, row));
  }

  @ApiOperation({ summary: 'Get a raw capture by composite key' })
  @ApiResponse({ status: 200, type: RawCaptureResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'RawCapture not found' })
  @Get(':offerId/:sourceId')
  async findOne(
    @Param('offerId') offerId: string,
    @Param('sourceId') sourceId: string,
  ) {
    const row = await this.rawCapturesService.findOne(offerId, sourceId);
    return this.toDto(RawCaptureResponseDto, row);
  }

  @ApiOperation({ summary: 'Delete a raw capture' })
  @ApiResponse({ status: 200, description: 'RawCapture deleted' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'RawCapture not found' })
  @Delete(':offerId/:sourceId')
  async remove(
    @Param('offerId') offerId: string,
    @Param('sourceId') sourceId: string,
  ) {
    await this.rawCapturesService.remove(offerId, sourceId);
    return { deleted: true };
  }
}
