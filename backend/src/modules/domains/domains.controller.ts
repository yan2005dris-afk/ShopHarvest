import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import { DomainsService } from './domains.service';
import {
  CreateDomainDto,
  UpdateDomainDto,
} from '@web-scraping/contracts/domains';

@ApiTags('Domains')
@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

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
    return this.domainsService.findAll(host);
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
    return this.domainsService.findOne(id);
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
    return this.domainsService.create(dto);
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
    return this.domainsService.update(id, dto);
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
