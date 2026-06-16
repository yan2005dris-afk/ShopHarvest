import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
} from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Get('domain/:domainRuleId')
  async findByDomain(@Param('domainRuleId') domainRuleId: string) {
    return this.productsService.findByDomain(domainRuleId);
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.productsService.create(body as any);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
