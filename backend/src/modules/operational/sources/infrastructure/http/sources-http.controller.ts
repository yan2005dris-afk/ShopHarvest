import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import {
  CreateSourceDto,
  SourceResponseDto,
  UpdateSourceDto,
} from '@web-scraping/contracts/sources';
import { CreateSourceUseCase } from '../../application/create-source.use-case';
import { DeleteSourceUseCase } from '../../application/delete-source.use-case';
import { FindSourceUseCase } from '../../application/find-source.use-case';
import { ListSourcesUseCase } from '../../application/list-sources.use-case';
import { UpdateSourceUseCase } from '../../application/update-source.use-case';
import {
  DuplicateSourceCodeError,
  InvalidSourceStatusTransitionError,
  SourceNotFoundError,
} from '../../domain/source.errors';
import { Source } from '../../domain/source.entity';
import { SourceResponseMapper } from './source-response.mapper';

@ApiTags('Sources')
@Controller('sources')
export class SourcesHttpController {
  constructor(
    @Inject(CreateSourceUseCase)
    private readonly createUseCase: CreateSourceUseCase,
    @Inject(FindSourceUseCase) private readonly findUseCase: FindSourceUseCase,
    @Inject(ListSourcesUseCase)
    private readonly listUseCase: ListSourcesUseCase,
    @Inject(UpdateSourceUseCase)
    private readonly updateUseCase: UpdateSourceUseCase,
    @Inject(DeleteSourceUseCase)
    private readonly deleteUseCase: DeleteSourceUseCase,
  ) {}

  @ApiOperation({ summary: 'List all scraping sources' })
  @ApiResponse({ status: 200, type: SourceResponseDto, isArray: true })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @Get()
  async findAll(): Promise<SourceResponseDto[]> {
    const sources = await this.listUseCase.execute();
    return sources.map(SourceResponseMapper.toDto);
  }

  @ApiOperation({ summary: 'Get a single source by id' })
  @ApiResponse({ status: 200, type: SourceResponseDto })
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
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<SourceResponseDto> {
    const source = await this.findUseCase.execute(id);
    return SourceResponseMapper.toDto(source);
  }

  @ApiOperation({ summary: 'Create a new scraping source' })
  @ApiResponse({ status: 201, type: SourceResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'Duplicate source code',
  })
  @Post()
  async create(@Body() dto: CreateSourceDto): Promise<SourceResponseDto> {
    try {
      const source = await this.createUseCase.execute({
        code: dto.code,
        name: dto.name,
        baseUrl: dto.baseUrl,
        config: dto.config ?? null,
      });
      return SourceResponseMapper.toDto(source);
    } catch (error) {
      throw SourcesHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Update an existing source' })
  @ApiResponse({ status: 200, type: SourceResponseDto })
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
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSourceDto,
  ): Promise<SourceResponseDto> {
    try {
      const source = await this.updateUseCase.execute({
        id,
        name: dto.name,
        baseUrl: dto.baseUrl,
        status: dto.status as Source['status'] | undefined,
        config: dto.config,
      });
      return SourceResponseMapper.toDto(source);
    } catch (error) {
      throw SourcesHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Delete a source' })
  @ApiResponse({ status: 200, description: 'Source deleted' })
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
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ deleted: true }> {
    try {
      await this.deleteUseCase.execute(id);
    } catch (error) {
      throw SourcesHttpController.mapDomainError(error);
    }
    return { deleted: true };
  }

  /**
   * Single point that translates domain errors into HTTP exceptions.
   * Use cases stay framework-agnostic; this is where the HTTP boundary lives.
   */
  private static mapDomainError(error: unknown): HttpException {
    if (error instanceof SourceNotFoundError) {
      return new NotFoundException(error.message);
    }
    if (error instanceof DuplicateSourceCodeError) {
      return new ConflictException(error.message);
    }
    if (error instanceof InvalidSourceStatusTransitionError) {
      return new BadRequestException(error.message);
    }
    return new HttpException(
      (error as Error)?.message ?? 'Internal error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
