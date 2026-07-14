import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import {
  IngestRawCaptureDto,
  RawCaptureResponseDto,
} from '@web-scraping/contracts/raw-captures';
import { DeleteRawCaptureUseCase } from '../../application/delete-raw-capture.use-case';
import { FindRawCaptureUseCase } from '../../application/find-raw-capture.use-case';
import { ListRawCapturesUseCase } from '../../application/list-raw-captures.use-case';
import { UpsertRawCaptureUseCase } from '../../application/upsert-raw-capture.use-case';
import {
  RawCaptureNotFoundError,
  RawCaptureOfferNotFoundError,
  RawCaptureSourceNotFoundError,
} from '../../domain/raw-capture.errors';
import { RawCaptureResponseMapper } from './raw-capture-response.mapper';

@ApiTags('RawCaptures')
@Controller('raw-captures')
export class RawCapturesHttpController {
  constructor(
    @Inject(UpsertRawCaptureUseCase)
    private readonly upsertUseCase: UpsertRawCaptureUseCase,
    @Inject(FindRawCaptureUseCase)
    private readonly findUseCase: FindRawCaptureUseCase,
    @Inject(ListRawCapturesUseCase)
    private readonly listUseCase: ListRawCapturesUseCase,
    @Inject(DeleteRawCaptureUseCase)
    private readonly deleteUseCase: DeleteRawCaptureUseCase,
  ) {}

  @ApiOperation({ summary: 'Ingest or upsert a raw capture' })
  @ApiResponse({ status: 201, type: RawCaptureResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Source not found',
  })
  @Post()
  async upsert(
    @Body() dto: IngestRawCaptureDto,
  ): Promise<RawCaptureResponseDto> {
    try {
      const capture = await this.upsertUseCase.execute({
        offerId: dto.offerId,
        sourceId: dto.sourceId,
        payload: dto.payload,
      });
      return RawCaptureResponseMapper.toDto(capture);
    } catch (error) {
      throw RawCapturesHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({
    summary: 'List raw captures (optionally filtered by sourceId)',
  })
  @ApiQuery({ name: 'sourceId', required: false, type: String })
  @ApiResponse({ status: 200, type: RawCaptureResponseDto, isArray: true })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @Get()
  async findAll(
    @Query('sourceId') sourceId?: string,
  ): Promise<RawCaptureResponseDto[]> {
    const captures = await this.listUseCase.execute(sourceId);
    return captures.map((capture) => RawCaptureResponseMapper.toDto(capture));
  }

  @ApiOperation({ summary: 'Get a raw capture by composite key' })
  @ApiResponse({ status: 200, type: RawCaptureResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'RawCapture not found',
  })
  @Get(':offerId/:sourceId')
  async findOne(
    @Param('offerId') offerId: string,
    @Param('sourceId') sourceId: string,
  ): Promise<RawCaptureResponseDto> {
    try {
      const capture = await this.findUseCase.execute(offerId, sourceId);
      return RawCaptureResponseMapper.toDto(capture);
    } catch (error) {
      throw RawCapturesHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Delete a raw capture' })
  @ApiResponse({ status: 200, description: 'RawCapture deleted' })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'RawCapture not found',
  })
  @Delete(':offerId/:sourceId')
  async remove(
    @Param('offerId') offerId: string,
    @Param('sourceId') sourceId: string,
  ): Promise<{ deleted: true }> {
    try {
      await this.deleteUseCase.execute(offerId, sourceId);
    } catch (error) {
      throw RawCapturesHttpController.mapDomainError(error);
    }
    return { deleted: true };
  }

  private static mapDomainError(error: unknown): HttpException {
    if (
      error instanceof RawCaptureSourceNotFoundError ||
      error instanceof RawCaptureOfferNotFoundError ||
      error instanceof RawCaptureNotFoundError
    ) {
      return new NotFoundException(error.message);
    }
    // Rethrow unknown errors so the global HttpExceptionFilter sanitizes
    // them (Prisma code mapping P2002→409 / P2025→404, prod redaction to
    // "Unexpected error"). Wrapping here as HttpException(500, ...) would
    // bypass that filter and leak raw Prisma messages to the wire.
    throw error as Error;
  }
}
