import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { UpsertProductDto, ProductQueryDto } from './dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(@Query() query: ProductQueryDto) {
    const includeHistory = query.includeHistory ?? true;
    let products;

    if (query.domainRuleId) {
      products = await this.productsService.findAllByDomain(query.domainRuleId);
    } else {
      products = await this.productsService.findAll(includeHistory);
    }

    return products;
  }

  @Post('ingest')
  async ingestFromExtension(
    @Body() body: { domain: string; pageUrl?: string; products: Record<string, unknown>[] },
  ) {
    return this.productsService.ingestFromExtension(body.domain, body.pageUrl, body.products);
  }

  @Post('upsert')
  async upsert(@Body() body: UpsertProductDto) {
    return this.productsService.upsert(body);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const product = await this.productsService.findOne(id);
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    return product;
  }

  @Get(':id/history')
  async getPriceHistory(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const product = await this.productsService.findOne(id);
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    return this.productsService.getPriceHistory(id, from, to);
  }

  @Get('domain/:domainRuleId')
  async findByDomain(@Param('domainRuleId') domainRuleId: string) {
    return this.productsService.findAllByDomain(domainRuleId);
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
