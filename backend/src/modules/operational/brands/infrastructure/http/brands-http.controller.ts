import {
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
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import {
  BrandResponseDto,
  CreateBrandDto,
  FuzzyMatchResultDto,
  UpdateBrandDto,
} from '@web-scraping/contracts/brands';
import { CreateBrandUseCase } from '../../application/create-brand.use-case';
import { DeleteBrandUseCase } from '../../application/delete-brand.use-case';
import { FindBrandUseCase } from '../../application/find-brand.use-case';
import { FuzzyMatchBrandsUseCase } from '../../application/fuzzy-match-brands.use-case';
import { ListBrandsUseCase } from '../../application/list-brands.use-case';
import { UpdateBrandUseCase } from '../../application/update-brand.use-case';
import {
  BrandNotFoundError,
  DuplicateBrandNameError,
} from '../../domain/brand.errors';
import {
  BrandResponseMapper,
  parseFuzzyMatchQuery,
} from './brand-response.mapper';

@ApiTags('Brands')
@Controller('brands')
export class BrandsHttpController {
  constructor(
    @Inject(CreateBrandUseCase)
    private readonly createUseCase: CreateBrandUseCase,
    @Inject(FindBrandUseCase) private readonly findUseCase: FindBrandUseCase,
    @Inject(FuzzyMatchBrandsUseCase)
    private readonly fuzzyMatchUseCase: FuzzyMatchBrandsUseCase,
    @Inject(ListBrandsUseCase) private readonly listUseCase: ListBrandsUseCase,
    @Inject(UpdateBrandUseCase)
    private readonly updateUseCase: UpdateBrandUseCase,
    @Inject(DeleteBrandUseCase)
    private readonly deleteUseCase: DeleteBrandUseCase,
  ) {}

  @ApiOperation({ summary: 'List all brands' })
  @ApiResponse({ status: 200, type: BrandResponseDto, isArray: true })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @Get()
  async findAll(): Promise<BrandResponseDto[]> {
    const brands = await this.listUseCase.execute();
    return brands.map(BrandResponseMapper.toDto);
  }

  // NOTE: this route MUST be declared before `:id` so that NestJS does not
  // match `:id="fuzzy"`. Route order matters: GET /:id eats everything else
  // when declared first.
  @ApiOperation({ summary: 'Fuzzy-match brands by name' })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Search query',
  })
  @ApiQuery({
    name: 'threshold',
    required: false,
    type: Number,
    description: 'Minimum similarity (default 0.6)',
  })
  @ApiResponse({ status: 200, type: FuzzyMatchResultDto, isArray: true })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @Get('fuzzy')
  async fuzzyMatch(
    @Query('q') q: string,
    @Query('threshold') threshold?: string,
  ): Promise<FuzzyMatchResultDto[]> {
    const results = await this.fuzzyMatchUseCase.execute(
      parseFuzzyMatchQuery(q, threshold),
    );
    return results.map(BrandResponseMapper.fuzzyCandidateToDto);
  }

  @ApiOperation({ summary: 'Get a single brand by id' })
  @ApiResponse({ status: 200, type: BrandResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Brand not found',
  })
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<BrandResponseDto> {
    const brand = await this.findUseCase.execute(id);
    return BrandResponseMapper.toDto(brand);
  }

  @ApiOperation({ summary: 'Create a new brand' })
  @ApiResponse({ status: 201, type: BrandResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'Duplicate brand name',
  })
  @Post()
  async create(@Body() dto: CreateBrandDto): Promise<BrandResponseDto> {
    try {
      const brand = await this.createUseCase.execute({
        name: dto.name,
        aliases: dto.aliases,
      });
      return BrandResponseMapper.toDto(brand);
    } catch (error) {
      throw BrandsHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Update a brand' })
  @ApiResponse({ status: 200, type: BrandResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Brand not found',
  })
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBrandDto,
  ): Promise<BrandResponseDto> {
    try {
      const brand = await this.updateUseCase.execute({
        id,
        name: dto.name,
        aliases: dto.aliases,
      });
      return BrandResponseMapper.toDto(brand);
    } catch (error) {
      throw BrandsHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Delete a brand' })
  @ApiResponse({ status: 200, description: 'Brand deleted' })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Brand not found',
  })
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ deleted: true }> {
    try {
      await this.deleteUseCase.execute(id);
    } catch (error) {
      throw BrandsHttpController.mapDomainError(error);
    }
    return { deleted: true };
  }

  /**
   * Single point that translates domain errors into HTTP exceptions.
   * Use cases stay framework-agnostic; this is where the HTTP boundary lives.
   */
  private static mapDomainError(error: unknown): HttpException {
    if (error instanceof BrandNotFoundError) {
      return new NotFoundException(error.message);
    }
    if (error instanceof DuplicateBrandNameError) {
      return new ConflictException(error.message);
    }
    return new HttpException(
      (error as Error)?.message ?? 'Internal error',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
