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
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
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

  /**
   * Single-source plainToInstance wrapper. Coerces Prisma `Decimal.toJSON()`
   * strings back to JS numbers via `@Type(() => Number)` on the DTOs and
   * strips Prisma nested relations through the `@Expose()` whitelist with
   * `excludeExtraneousValues: true`. Centralizing avoids repeating the
   * option (missing it leaks `domainRule`/`priceHistory` into the wire and
   * crashes on the second capture with `[DecimalError] Invalid argument: undefined`).
   */
  private toDto<T extends object, V>(cls: new () => T, row: V): T {
    return plainToInstance(cls, row, { excludeExtraneousValues: true });
  }

  @ApiOperation({ summary: 'List extracted products' })
  @ApiQuery({ name: 'domainRuleId', required: false, type: String })
  @ApiQuery({ name: 'includeHistory', required: false, type: Boolean })
  @ApiResponse({ status: 200, type: ProductResponseDto, isArray: true })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
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
    return products.map((row) => this.toDto(ProductResponseDto, row));
  }

  @ApiOperation({
    summary: 'Ingest a batch of products extracted by the browser extension',
  })
  @ApiResponse({ status: 201, type: ProductResponseDto, isArray: true })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @Post('ingest')
  async ingestFromExtension(@Body() dto: IngestProductsDto) {
    return this.productsService.ingestFromExtension(dto);
  }

  @ApiOperation({ summary: 'Upsert a product by (domainRuleId, productUrl)' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Domain rule not found',
  })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'Unique constraint violation (P2002)',
  })
  @Post('upsert')
  async upsert(@Body() body: UpsertProductDto) {
    return this.productsService.upsert(body);
  }

  @ApiOperation({ summary: 'Get a single product by id' })
  @ApiResponse({ status: 200, type: ProductResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Product not found',
  })
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
    // 4R BLOCKER fix: `excludeExtraneousValues: true` (now centralized in
    // `this.toDto`) activates the @Expose() whitelist so Prisma's nested
    // `domainRule` relation and `priceHistory[]` array are STRIPPED before
    // serialization — without it, class-transformer recurses into nested
    // relations and crashes with `[DecimalError] Invalid argument: undefined`
    // on every request where priceHistory is non-empty. See pre-PR 4R review R1 BLOCKER.
    return this.toDto(ProductResponseDto, product);
  }

  @ApiOperation({ summary: 'Get the price history for a product' })
  @ApiResponse({ status: 200, type: PriceHistoryResponseDto, isArray: true })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Product not found',
  })
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
    // Same Decimal→number fix as findOne, applied per entry. 4R CRITICAL #3
    // fix: `excludeExtraneousValues: true` (via `this.toDto`) activates the
    // @Expose() whitelist — without it, `productId` (FK to Product) and the
    // joined `product` relation leak into the wire response.
    const history = await this.productsService.getPriceHistory(id, from, to);
    return history.map((entry) => this.toDto(PriceHistoryResponseDto, entry));
  }

  @ApiOperation({ summary: 'List products scoped to a single domain rule' })
  @ApiResponse({ status: 200, type: ProductResponseDto, isArray: true })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Domain rule not found',
  })
  @Get('by-domain/:domainRuleId')
  async findByDomain(@Param('domainRuleId') domainRuleId: string) {
    const rows = await this.productsService.findAllByDomain(domainRuleId);
    // 4R CRITICAL #2 fix: same wrap as findAll above. Without this the
    // list endpoint ships `price: "19.99"` (string) instead of `price: 19.99`
    // (number), AND leaks nested `domainRule` + `priceHistory[]` relations.
    return rows.map((row) => this.toDto(ProductResponseDto, row));
  }

  // TODO: remove this legacy admin path entirely. It accepts an untyped body
  // (cast through `any`), bypasses the ValidationPipe contract, and duplicates
  // `POST /products/upsert`. Hidden from the Swagger UI via @ApiExcludeEndpoint
  // until the upsert endpoint is confirmed stable enough to delete this.
  @ApiExcludeEndpoint()
  @ApiOperation({
    summary: 'Create a product (legacy admin path, do not use)',
  })
  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.productsService.create(body as any);
  }

  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @ApiResponse({
    status: 404,
    type: ErrorResponseDto,
    description: 'Product not found',
  })
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
