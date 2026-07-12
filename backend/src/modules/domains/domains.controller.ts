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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import { DomainsService } from './domains.service';
import {
  CreateDomainDto,
  UpdateDomainDto,
  DomainResponseDto,
} from '@web-scraping/contracts/domains';

@ApiTags('Domains')
@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  private toDto(row: unknown): DomainResponseDto {
    return plainToInstance(DomainResponseDto, row, {
      excludeExtraneousValues: true,
    });
  }

  private mapCategory(row: Record<string, unknown>): Record<string, unknown> {
    const category = row.category as { id: string; name: string } | null;
    if (category) {
      row['categoryName'] = category.name;
    }
    delete row.category;
    return row;
  }

  // `host` lets the extension look up the saved rule for the current page
  // (used by the batch-5 auto-replay scheduler).
  @ApiOperation({
    summary: 'List all domain rules (optionally filtered by host)',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @Get()
  async findAll(@Query('host') host?: string) {
    const rows = await this.domainsService.findAll(host);
    return rows.map((r) => this.toDto(this.mapCategory(r as unknown as Record<string, unknown>)));
  }

  @ApiOperation({ summary: 'Get a single domain rule by id' })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Domain not found',
  })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const row = await this.domainsService.findOne(id);
    if (!row) throw new NotFoundException(`Domain rule with id ${id} not found`);
    return this.toDto(this.mapCategory(row as unknown as Record<string, unknown>));
  }

  @ApiOperation({ summary: 'Create a new domain rule' })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'Unique constraint violation (P2002)',
  })
  @Post()
  async create(@Body() dto: CreateDomainDto) {
    const row = await this.domainsService.create(dto);
    return this.toDto(this.mapCategory(row as unknown as Record<string, unknown>));
  }

  @ApiOperation({ summary: 'Update an existing domain rule' })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Domain not found',
  })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateDomainDto) {
    const row = await this.domainsService.update(id, dto);
    return this.toDto(this.mapCategory(row as unknown as Record<string, unknown>));
  }

  @ApiOperation({ summary: 'Delete a domain rule' })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Domain not found',
  })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.domainsService.remove(id);
  }
}
