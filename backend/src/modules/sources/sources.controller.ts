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
  CreateSourceDto,
  UpdateSourceDto,
  SourceResponseDto,
} from '@web-scraping/contracts/sources';
import { SourcesService } from './sources.service';

@ApiTags('Sources')
@Controller('sources')
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  private toDto<T extends object, V>(cls: new () => T, row: V): T {
    return plainToInstance(cls, row, { excludeExtraneousValues: true });
  }

  @ApiOperation({ summary: 'List all scraping sources' })
  @ApiResponse({ status: 200, type: SourceResponseDto, isArray: true })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @Get()
  async findAll() {
    const rows = await this.sourcesService.findAll();
    return rows.map((row) => this.toDto(SourceResponseDto, row));
  }

  @ApiOperation({ summary: 'Get a single source by id' })
  @ApiResponse({ status: 200, type: SourceResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Source not found' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const row = await this.sourcesService.findOne(id);
    return this.toDto(SourceResponseDto, row);
  }

  @ApiOperation({ summary: 'Create a new scraping source' })
  @ApiResponse({ status: 201, type: SourceResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 409, type: ErrorResponseDto, description: 'Duplicate source code' })
  @Post()
  async create(@Body() dto: CreateSourceDto) {
    const row = await this.sourcesService.create(dto);
    return this.toDto(SourceResponseDto, row);
  }

  @ApiOperation({ summary: 'Update an existing source' })
  @ApiResponse({ status: 200, type: SourceResponseDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Source not found' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateSourceDto) {
    const row = await this.sourcesService.update(id, dto);
    return this.toDto(SourceResponseDto, row);
  }

  @ApiOperation({ summary: 'Delete a source' })
  @ApiResponse({ status: 200, description: 'Source deleted' })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Validation failed' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'Source not found' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.sourcesService.remove(id);
    return { deleted: true };
  }
}
