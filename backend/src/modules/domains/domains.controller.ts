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
import { DomainsService } from './domains.service';
import { CreateDomainDto, UpdateDomainDto } from './dto';

@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  // `host` lets the extension look up the saved rule for the current page
  // (used by the batch-5 auto-replay scheduler).
  @Get()
  async findAll(@Query('host') host?: string) {
    return this.domainsService.findAll(host);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.domainsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateDomainDto) {
    return this.domainsService.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateDomainDto) {
    return this.domainsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.domainsService.remove(id);
  }
}
