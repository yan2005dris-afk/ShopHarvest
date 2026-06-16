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
  async create(
    @Body()
    data: {
      domain: string;
      name: string;
      selectorTitle: string;
      selectorPrice: string;
      selectorImage?: string;
      selectorSku?: string;
      selectorType?: string;
      paginationType?: string;
      paginationSelector?: string;
      sampleUrl?: string;
    },
  ) {
    return this.domainsService.create(data);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    data: Partial<{
      domain: string;
      name: string;
      selectorTitle: string;
      selectorPrice: string;
      selectorImage: string;
      selectorSku: string;
      selectorType: string;
      paginationType: string;
      paginationSelector: string;
      sampleUrl: string;
    }>,
  ) {
    return this.domainsService.update(id, data);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.domainsService.remove(id);
  }
}
