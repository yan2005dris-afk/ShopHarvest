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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DomainsService } from './domains.service';
import {
  CreateDomainDto,
  DomainResponseDto,
  UpdateDomainDto,
} from '@web-scraping/contracts/domains';

@ApiTags('Domains')
@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  // `host` lets the extension look up the saved rule for the current page
  // (used by the batch-5 auto-replay scheduler).
  @ApiOperation({ summary: 'List all domain rules (optionally filtered by host)' })
  @Get()
  async findAll(@Query('host') host?: string) {
    return this.domainsService.findAll(host);
  }

  @ApiOperation({ summary: 'Get a single domain rule by id' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.domainsService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new domain rule' })
  @Post()
  async create(@Body() dto: CreateDomainDto) {
    return this.domainsService.create(dto);
  }

  @ApiOperation({ summary: 'Update an existing domain rule' })
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateDomainDto) {
    return this.domainsService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a domain rule' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.domainsService.remove(id);
  }
}
