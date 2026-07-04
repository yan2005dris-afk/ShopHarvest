import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { DomainsService } from './domains.service';
import { CreateDomainDto, UpdateDomainDto } from './dto';

@Controller('domains')
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  async findAll() {
    return this.domainsService.findAll();
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
