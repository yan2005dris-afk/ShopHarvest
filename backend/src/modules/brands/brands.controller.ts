import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import {
  CreateBrandDto,
  UpdateBrandDto,
  BrandResponseDto,
  FuzzyMatchResultDto,
} from '@web-scraping/contracts/brands';
import { BrandsService } from './brands.service';

@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  private toDto<T extends object, V>(cls: new () => T, row: V): T {
    return plainToInstance(cls, row, { excludeExtraneousValues: true });
  }

  @ApiOperation({ summary: 'List all brands' })
  @ApiResponse({ status: 200, type: BrandResponseDto, isArray: true })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @Get()
  async findAll() {
    const rows = await this.brandsService.findAll();
    return rows.map((row) => this.toDto(BrandResponseDto, row));
  }

  @ApiOperation({ summary: 'Fuzzy-match brands by name' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query' })
  @ApiQuery({ name: 'threshold', required: false, type: Number, description: 'Minimum similarity (default 0.6)' })
  @ApiResponse({ status: 200, type: FuzzyMatchResultDto, isArray: true })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @Get('fuzzy')
  async fuzzyMatch(
    @Query('q') q: string,
    @Query('threshold') threshold?: string,
  ) {
    const th = threshold ? parseFloat(threshold) : 0.6;
    const results = await this.brandsService.fuzzyMatch(q, th);
    return results.map((r) => ({
      brand: r.brand ? this.toDto(BrandResponseDto, r.brand) : null,
      similarity: r.similarity,
      lowConfidence: r.lowConfidence,
    }));
  }

  @ApiOperation({ summary: 'Get a single brand by id' })
  @ApiResponse({ status: 200, type: BrandResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Brand not found' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const row = await this.brandsService.findOne(id);
    return this.toDto(BrandResponseDto, row);
  }

  @ApiOperation({ summary: 'Create a new brand' })
  @ApiResponse({ status: 201, type: BrandResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 409, type: ErrorResponseDto, description: 'Duplicate brand name' })
  @Post()
  async create(@Body() dto: CreateBrandDto) {
    const row = await this.brandsService.create(dto);
    return this.toDto(BrandResponseDto, row);
  }

  @ApiOperation({ summary: 'Update a brand' })
  @ApiResponse({ status: 200, type: BrandResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Brand not found' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    const row = await this.brandsService.update(id, dto);
    return this.toDto(BrandResponseDto, row);
  }

  @ApiOperation({ summary: 'Delete a brand' })
  @ApiResponse({ status: 200, description: 'Brand deleted' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Brand not found' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.brandsService.remove(id);
    return { deleted: true };
  }
}
