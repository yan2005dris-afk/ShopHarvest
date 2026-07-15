import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import {
  CreateDomainDto,
  DomainResponseDto,
  UpdateDomainDto,
} from '@web-scraping/contracts/domains';
import { CreateDomainUseCase } from '../../application/create-domain.use-case';
import { DeleteDomainUseCase } from '../../application/delete-domain.use-case';
import { FindDomainUseCase } from '../../application/find-domain.use-case';
import { ListDomainsUseCase } from '../../application/list-domains.use-case';
import { UpdateDomainUseCase } from '../../application/update-domain.use-case';
import {
  DomainCategoryNotFoundError,
  DomainRuleNotFoundError,
  DuplicateDomainRuleError,
} from '../../domain/domain.errors';
import { DomainResponseMapper } from './domain-response.mapper';

@ApiTags('Domains')
@Controller('domains')
export class DomainsHttpController {
  constructor(
    @Inject(ListDomainsUseCase)
    private readonly listUseCase: ListDomainsUseCase,
    @Inject(FindDomainUseCase)
    private readonly findUseCase: FindDomainUseCase,
    @Inject(CreateDomainUseCase)
    private readonly createUseCase: CreateDomainUseCase,
    @Inject(UpdateDomainUseCase)
    private readonly updateUseCase: UpdateDomainUseCase,
    @Inject(DeleteDomainUseCase)
    private readonly deleteUseCase: DeleteDomainUseCase,
  ) {}

  // `host` lets the extension look up the saved rule for the current page
  // (used by the batch-5 auto-replay scheduler).
  @ApiOperation({
    summary: 'List all domain rules (optionally filtered by host)',
  })
  @ApiQuery({ name: 'host', required: false, type: String })
  @ApiResponse({ status: 200, type: DomainResponseDto, isArray: true })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @Get()
  async findAll(@Query('host') host?: string): Promise<DomainResponseDto[]> {
    const results = await this.listUseCase.execute(host);
    return results.map((load) => DomainResponseMapper.toDto(load));
  }

  @ApiOperation({ summary: 'Get a single domain rule by id' })
  @ApiResponse({ status: 200, type: DomainResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Domain rule not found',
  })
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<DomainResponseDto> {
    try {
      const load = await this.findUseCase.execute(id);
      return DomainResponseMapper.toDto(load);
    } catch (error) {
      throw DomainsHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Create a new domain rule' })
  @ApiResponse({ status: 201, type: DomainResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Category not found',
  })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'Unique constraint violation (P2002)',
  })
  @Post()
  async create(@Body() dto: CreateDomainDto): Promise<DomainResponseDto> {
    try {
      const load = await this.createUseCase.execute({
        domain: dto.domain,
        name: dto.name,
        categoryId: dto.categoryId ?? null,
        fieldMappings: dto.fieldMappings,
        containerSelector: dto.containerSelector ?? null,
        productLimit: dto.productLimit ?? null,
        sampleUrl: dto.sampleUrl ?? null,
      });
      return DomainResponseMapper.toDto(load);
    } catch (error) {
      throw DomainsHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Update an existing domain rule' })
  @ApiResponse({ status: 200, type: DomainResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Domain rule not found',
  })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDomainDto,
  ): Promise<DomainResponseDto> {
    try {
      const load = await this.updateUseCase.execute({
        id,
        domain: dto.domain,
        name: dto.name,
        categoryId: dto.categoryId,
        fieldMappings: dto.fieldMappings,
        containerSelector: dto.containerSelector,
        productLimit: dto.productLimit,
        sampleUrl: dto.sampleUrl,
      });
      return DomainResponseMapper.toDto(load);
    } catch (error) {
      throw DomainsHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Delete a domain rule' })
  @ApiResponse({ status: 200, description: 'Domain rule deleted' })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Domain rule not found',
  })
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ deleted: true }> {
    try {
      await this.deleteUseCase.execute(id);
    } catch (error) {
      throw DomainsHttpController.mapDomainError(error);
    }
    return { deleted: true };
  }

  /**
   * Single point that translates domain errors into HTTP exceptions.
   * Anything that is not a known domain error is rethrown so the global
   * HttpExceptionFilter sanitizes it (Prisma P2002→409, P2025→404, generic
   * errors → "Unexpected error" in production). Wrapping the raw
   * `error.message` in `HttpException(500)` would bypass that filter and
   * leak internal traces.
   */
  private static mapDomainError(error: unknown): HttpException {
    if (error instanceof DomainRuleNotFoundError) {
      return new NotFoundException(error.message);
    }
    if (error instanceof DomainCategoryNotFoundError) {
      return new NotFoundException(error.message);
    }
    if (error instanceof DuplicateDomainRuleError) {
      return new ConflictException(error.message);
    }
    throw error as Error;
  }
}
