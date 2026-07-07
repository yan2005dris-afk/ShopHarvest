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
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { ProductsService } from './products.service';
import {
  UpsertProductDto,
  ProductQueryDto,
  IngestProductsDto,
  ProductResponseDto,
  PriceHistoryResponseDto,
} from '@web-scraping/contracts/products';

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @ApiOperation({ summary: 'List extracted products' })
  @ApiQuery({ name: 'domainRuleId', required: false, type: String })
  @ApiQuery({ name: 'includeHistory', required: false, type: Boolean })
  @Get()
  async findAll(@Query() query: ProductQueryDto) {
    const includeHistory = query.includeHistory ?? true;
    let products;

    if (query.domainRuleId) {
      products = await this.productsService.findAllByDomain(query.domainRuleId);
    } else {
      products = await this.productsService.findAll(includeHistory);
    }

    // 4R CRITICAL #2 fix: wrap list endpoints with plainToInstance so the
    // @Type(() => Number) decorator on ProductResponseDto.price coerces
    // the Prisma `Decimal.toJSON()` string back to a real JS number on
    // the wire — AND `excludeExtraneousValues: true` strips nested
    // `domainRule` + `priceHistory[]` relations from the response.
    return products.map((row) =>
      plainToInstance(ProductResponseDto, row, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @ApiOperation({ summary: 'Ingest a batch of products extracted by the browser extension' })
  @Post('ingest')
  async ingestFromExtension(@Body() dto: IngestProductsDto) {
    return this.productsService.ingestFromExtension(dto);
  }

  @ApiOperation({ summary: 'Upsert a product by (domainRuleId, productUrl)' })
  @Post('upsert')
  async upsert(@Body() body: UpsertProductDto) {
    return this.productsService.upsert(body);
  }

  @ApiOperation({ summary: 'Get a single product by id' })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const product = await this.productsService.findOne(id);
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    // Spec 2 REQ-DT-1: pipe Prisma row through plainToInstance so the
    // @Type(() => Number) decorator on ProductResponseDto.price coerces
    // the JSON-string Decimal back to a real JS number on the wire.
    //
    // 4R BLOCKER fix: `excludeExtraneousValues: true` activates the
    // @Expose() whitelist so Prisma's nested `domainRule` relation and
    // `priceHistory[]` array are STRIPPED before serialization — without
    // it, class-transformer recurses into nested relations and crashes
    // with `[DecimalError] Invalid argument: undefined` on every request
    // where priceHistory is non-empty (always, after the first history
    // capture). See pre-PR 4R review R1 BLOCKER.
    return plainToInstance(ProductResponseDto, product, {
      excludeExtraneousValues: true,
    });
  }

  @ApiOperation({ summary: 'Get the price history for a product' })
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
    // Same Decimal→number fix as findOne, applied per entry.
    //
    // 4R CRITICAL #3 fix: `excludeExtraneousValues: true` activates the
    // @Expose() whitelist — without it, `productId` (FK to Product) and
    // the joined `product` relation leak into the wire response.
    const history = await this.productsService.getPriceHistory(id, from, to);
    return history.map((entry) =>
      plainToInstance(PriceHistoryResponseDto, entry, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @ApiOperation({ summary: 'List products scoped to a single domain rule' })
  @Get('by-domain/:domainRuleId')
  async findByDomain(@Param('domainRuleId') domainRuleId: string) {
    const rows = await this.productsService.findAllByDomain(domainRuleId);
    // 4R CRITICAL #2 fix: same wrap as findAll above. Without this the
    // list endpoint ships `price: "19.99"` (string) instead of `price: 19.99`
    // (number), AND leaks nested `domainRule` + `priceHistory[]` relations.
    return rows.map((row) =>
      plainToInstance(ProductResponseDto, row, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @ApiOperation({ summary: 'Create a product (legacy admin path)' })
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.productsService.create(body as any);
  }

  @ApiOperation({ summary: 'Delete a product' })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
