import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryResponseDto,
} from '@web-scraping/contracts/categories';
import { CategoriesService } from './categories.service';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  private toDto<T extends object, V>(cls: new () => T, row: V): T {
    return plainToInstance(cls, row, { excludeExtraneousValues: true });
  }

  @ApiOperation({ summary: 'List all categories' })
  @ApiResponse({ status: 200, type: CategoryResponseDto, isArray: true })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @Get()
  async findAll() {
    const rows = await this.categoriesService.findAll();
    return rows.map((row) => this.toDto(CategoryResponseDto, row));
  }

  @ApiOperation({ summary: 'Get a single category by id' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Category not found' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const row = await this.categoriesService.findOne(id);
    return this.toDto(CategoryResponseDto, row);
  }

  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({ status: 201, type: CategoryResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Parent category not found' })
  @Post()
  async create(@Body() dto: CreateCategoryDto) {
    const row = await this.categoriesService.create(dto);
    return this.toDto(CategoryResponseDto, row);
  }

  @ApiOperation({ summary: 'Update a category (rename or reparent)' })
  @ApiResponse({ status: 200, type: CategoryResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Category not found' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    const row = await this.categoriesService.update(id, dto);
    return this.toDto(CategoryResponseDto, row);
  }

  @ApiOperation({ summary: 'Delete a category' })
  @ApiResponse({ status: 200, description: 'Category deleted' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Cannot delete category with children' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Category not found' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.categoriesService.remove(id);
    return { deleted: true };
  }

  @ApiOperation({ summary: 'Get ancestor chain for a category' })
  @ApiResponse({ status: 200, type: CategoryResponseDto, isArray: true })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Category not found' })
  @Get(':id/ancestors')
  async getAncestors(@Param('id') id: string) {
    const rows = await this.categoriesService.getAncestors(id);
    return rows.map((row) => this.toDto(CategoryResponseDto, row));
  }

  @ApiOperation({ summary: 'Get all descendants of a category' })
  @ApiResponse({ status: 200, type: CategoryResponseDto, isArray: true })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Category not found' })
  @Get(':id/descendants')
  async getDescendants(@Param('id') id: string) {
    const rows = await this.categoriesService.getDescendants(id);
    return rows.map((row) => this.toDto(CategoryResponseDto, row));
  }

  @ApiOperation({ summary: 'Get direct children of a category' })
  @ApiResponse({ status: 200, type: CategoryResponseDto, isArray: true })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Category not found' })
  @Get(':id/children')
  async getChildren(@Param('id') id: string) {
    const rows = await this.categoriesService.getChildren(id);
    return rows.map((row) => this.toDto(CategoryResponseDto, row));
  }

  // ── Category ↔ Source mappings ───────────────────────────────────

  @ApiOperation({ summary: 'Map a category to a source' })
  @ApiResponse({ status: 201, description: 'Mapping created' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Category or source not found' })
  @ApiResponse({ status: 409, type: ErrorResponseDto, description: 'Mapping already exists' })
  @Post(':id/mappings')
  async createMapping(
    @Param('id') id: string,
    @Body() body: { sourceId: string; remoteCode: string },
  ) {
    return this.categoriesService.createMapping(id, body.sourceId, body.remoteCode);
  }

  @ApiOperation({ summary: 'Get all mappings for a category' })
  @ApiResponse({ status: 200, description: 'List of mappings' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Category not found' })
  @Get(':id/mappings')
  async listMappings(@Param('id') id: string) {
    return this.categoriesService.listMappingsByCategory(id);
  }

  @ApiOperation({ summary: 'Remove a category-source mapping' })
  @ApiResponse({ status: 200, description: 'Mapping deleted' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Mapping not found' })
  @Delete(':id/mappings/:sourceId')
  async removeMapping(
    @Param('id') id: string,
    @Param('sourceId') sourceId: string,
  ) {
    await this.categoriesService.removeMapping(id, sourceId);
    return { deleted: true };
  }
}
