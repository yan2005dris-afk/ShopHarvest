import {
  BadRequestException,
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
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import {
  CategoryResponseDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '@web-scraping/contracts/categories';
import { CreateCategoryUseCase } from '../../application/create-category.use-case';
import { CreateCategorySourceMappingUseCase } from '../../application/create-category-source-mapping.use-case';
import { DeleteCategoryUseCase } from '../../application/delete-category.use-case';
import { FindCategoryUseCase } from '../../application/find-category.use-case';
import { ListCategoriesUseCase } from '../../application/list-categories.use-case';
import { ListCategoryAncestorsUseCase } from '../../application/list-category-ancestors.use-case';
import { ListCategoryChildrenUseCase } from '../../application/list-category-children.use-case';
import { ListCategoryDescendantsUseCase } from '../../application/list-category-descendants.use-case';
import { ListCategorySourceMappingsUseCase } from '../../application/list-category-source-mappings.use-case';
import { RemoveCategorySourceMappingUseCase } from '../../application/remove-category-source-mapping.use-case';
import { UpdateCategoryUseCase } from '../../application/update-category.use-case';
import {
  CategoryCycleError,
  CategoryHasChildrenError,
  CategoryNotFoundError,
  CategorySelfReferenceError,
  CategorySourceMappingNotFoundError,
  DuplicateCategorySourceMappingError,
  ParentCategoryNotFoundError,
  SourceNotFoundError,
} from '../../domain/category.errors';
import { CategoryResponseMapper } from './category-response.mapper';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesHttpController {
  constructor(
    @Inject(CreateCategoryUseCase)
    private readonly createUseCase: CreateCategoryUseCase,
    @Inject(FindCategoryUseCase)
    private readonly findUseCase: FindCategoryUseCase,
    @Inject(ListCategoriesUseCase)
    private readonly listUseCase: ListCategoriesUseCase,
    @Inject(UpdateCategoryUseCase)
    private readonly updateUseCase: UpdateCategoryUseCase,
    @Inject(DeleteCategoryUseCase)
    private readonly deleteUseCase: DeleteCategoryUseCase,
    @Inject(ListCategoryAncestorsUseCase)
    private readonly ancestorsUseCase: ListCategoryAncestorsUseCase,
    @Inject(ListCategoryDescendantsUseCase)
    private readonly descendantsUseCase: ListCategoryDescendantsUseCase,
    @Inject(ListCategoryChildrenUseCase)
    private readonly childrenUseCase: ListCategoryChildrenUseCase,
    @Inject(CreateCategorySourceMappingUseCase)
    private readonly createMappingUseCase: CreateCategorySourceMappingUseCase,
    @Inject(ListCategorySourceMappingsUseCase)
    private readonly listMappingsUseCase: ListCategorySourceMappingsUseCase,
    @Inject(RemoveCategorySourceMappingUseCase)
    private readonly removeMappingUseCase: RemoveCategorySourceMappingUseCase,
  ) {}

  @ApiOperation({ summary: 'List all categories' })
  @ApiResponse({ status: 200, type: CategoryResponseDto, isArray: true })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @Get()
  async findAll(): Promise<CategoryResponseDto[]> {
    const categories = await this.listUseCase.execute();
    return categories.map((category) => CategoryResponseMapper.toDto(category));
  }

  @ApiOperation({ summary: 'Get a single category by id' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
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
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<CategoryResponseDto> {
    try {
      const category = await this.findUseCase.execute(id);
      return CategoryResponseMapper.toDto(category);
    } catch (error) {
      throw CategoriesHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, type: CategoryResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Parent category not found',
  })
  @Post()
  async create(@Body() dto: CreateCategoryDto): Promise<CategoryResponseDto> {
    try {
      const category = await this.createUseCase.execute({
        name: dto.name,
        description: dto.description ?? null,
        parentId: dto.parentId ?? null,
        defaultFieldMappings: dto.defaultFieldMappings ?? null,
      });
      return CategoryResponseMapper.toDto(category);
    } catch (error) {
      throw CategoriesHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Update a category (rename or reparent)' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
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
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    try {
      const category = await this.updateUseCase.execute({
        id,
        name: dto.name,
        description: dto.description,
        defaultFieldMappings: dto.defaultFieldMappings,
        parentId: dto.parentId,
      });
      return CategoryResponseMapper.toDto(category);
    } catch (error) {
      throw CategoriesHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Delete a category' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Cannot delete category with children',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Category not found',
  })
  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ deleted: true }> {
    try {
      await this.deleteUseCase.execute(id);
    } catch (error) {
      throw CategoriesHttpController.mapDomainError(error);
    }
    return { deleted: true };
  }

  // ── Tree queries ─────────────────────────────────────────────────────
  // NOTE: the static routes below MUST be declared before ambiguous
  // `:id` routes. NestJS matches in declaration order and `@Get(':id')`
  // swallows every suffix otherwise. Re-declaring order is required
  // because they are sub-paths of the parent.

  @ApiOperation({ summary: 'Get ancestor chain for a category' })
  @ApiResponse({ status: 200, type: CategoryResponseDto, isArray: true })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Category not found',
  })
  @Get(':id/ancestors')
  async getAncestors(@Param('id') id: string): Promise<CategoryResponseDto[]> {
    try {
      const rows = await this.ancestorsUseCase.execute(id);
      return rows.map((row) => CategoryResponseMapper.toDto(row));
    } catch (error) {
      throw CategoriesHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Get all descendants of a category' })
  @ApiResponse({ status: 200, type: CategoryResponseDto, isArray: true })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Category not found',
  })
  @Get(':id/descendants')
  async getDescendants(
    @Param('id') id: string,
  ): Promise<CategoryResponseDto[]> {
    try {
      const rows = await this.descendantsUseCase.execute(id);
      return rows.map((row) => CategoryResponseMapper.toDto(row));
    } catch (error) {
      throw CategoriesHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Get direct children of a category' })
  @ApiResponse({ status: 200, type: CategoryResponseDto, isArray: true })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Category not found',
  })
  @Get(':id/children')
  async getChildren(@Param('id') id: string): Promise<CategoryResponseDto[]> {
    try {
      const rows = await this.childrenUseCase.execute(id);
      return rows.map((row) => CategoryResponseMapper.toDto(row));
    } catch (error) {
      throw CategoriesHttpController.mapDomainError(error);
    }
  }

  // ── Category ↔ Source mappings ──────────────────────────────────────

  @ApiOperation({ summary: 'Map a category to a source' })
  @ApiResponse({ status: 201, description: 'Mapping created' })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Category or source not found',
  })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'Mapping already exists',
  })
  @Post(':id/mappings')
  async createMapping(
    @Param('id') id: string,
    @Body() body: { sourceId: string; remoteCode: string },
  ): Promise<unknown> {
    try {
      const mapping = await this.createMappingUseCase.execute({
        categoryId: id,
        sourceId: body.sourceId,
        remoteCode: body.remoteCode,
      });
      return CategoryResponseMapper.mappingToDto({
        ...mapping,
        source: null,
      });
    } catch (error) {
      throw CategoriesHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Get all mappings for a category' })
  @ApiResponse({ status: 200, description: 'List of mappings' })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Category not found',
  })
  @Get(':id/mappings')
  async listMappings(@Param('id') id: string): Promise<unknown[]> {
    try {
      const rows = await this.listMappingsUseCase.execute(id);
      return rows.map((m) => CategoryResponseMapper.mappingToDto(m));
    } catch (error) {
      throw CategoriesHttpController.mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'Remove a category-source mapping' })
  @ApiResponse({ status: 200, description: 'Mapping deleted' })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Mapping not found',
  })
  @Delete(':id/mappings/:sourceId')
  async removeMapping(
    @Param('id') id: string,
    @Param('sourceId') sourceId: string,
  ): Promise<{ deleted: true }> {
    try {
      await this.removeMappingUseCase.execute(id, sourceId);
    } catch (error) {
      throw CategoriesHttpController.mapDomainError(error);
    }
    return { deleted: true };
  }

  /**
   * Single point that translates domain errors into HTTP exceptions.
   * Anything that is not a known category error is rethrown so the global
   * HttpExceptionFilter sanitizes it (Prisma P2002→409, P2025→404, generic
   * errors → "Unexpected error" in production). Wrapping the raw
   * `error.message` in `HttpException(500)` would bypass that filter and
   * leak internal traces.
   */
  private static mapDomainError(error: unknown): HttpException {
    if (error instanceof CategoryNotFoundError) {
      return new NotFoundException(error.message);
    }
    if (error instanceof ParentCategoryNotFoundError) {
      return new NotFoundException(error.message);
    }
    if (error instanceof SourceNotFoundError) {
      return new NotFoundException(error.message);
    }
    if (error instanceof CategorySourceMappingNotFoundError) {
      return new NotFoundException(error.message);
    }
    if (error instanceof DuplicateCategorySourceMappingError) {
      return new ConflictException(error.message);
    }
    if (error instanceof CategorySelfReferenceError) {
      return new BadRequestException(error.message);
    }
    if (error instanceof CategoryCycleError) {
      return new BadRequestException(error.message);
    }
    if (error instanceof CategoryHasChildrenError) {
      return new BadRequestException(error.message);
    }
    throw error as Error;
  }
}
