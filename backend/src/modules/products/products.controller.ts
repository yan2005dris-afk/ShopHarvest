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
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import { ProductsService } from './products.service';
import {
  ProductQueryDto,
  IngestProductsDto,
  ProductResponseDto,
  PriceObservationResponseDto,
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
   * option (missing it leaks unlisted relations into the wire and crashes
   * on a live `Prisma.Decimal` with `[DecimalError] Invalid argument: undefined`).
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

    // `excludeExtraneousValues: true` activates the @Expose() whitelist on
    // ProductResponseDto/OfferResponseDto so nested Prisma relations are
    // stripped AND the @Type(() => Number) decorator on OfferResponseDto.price
    // coerces the Prisma `Decimal.toJSON()` string back to a real JS number.
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
    // @Type(() => Number) decorator on OfferResponseDto.price coerces the
    // JSON-string Decimal back to a real JS number on the wire.
    //
    // `excludeExtraneousValues: true` (centralized in `this.toDto`)
    // activates the @Expose() whitelist so Prisma's nested `offers[]`
    // relation is walked ONLY through OfferResponseDto's own whitelist —
    // without it, class-transformer recurses into unannotated fields and
    // crashes with `[DecimalError] Invalid argument: undefined`.
    return this.toDto(ProductResponseDto, product);
  }

  @ApiOperation({
    summary: 'Get the price history for a product, across all its offers',
  })
  @ApiResponse({ status: 200, type: PriceObservationResponseDto, isArray: true })
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
    // Same Decimal→number fix as findOne, applied per entry. Each entry
    // still carries its own `offerId` (spec: "Price History Retrieval
    // Across Offers" — observations stay attributable per Offer). The
    // @Expose() whitelist (via `this.toDto`) strips the joined `offer`
    // relation, if the caller ever selects it.
    const history = await this.productsService.getPriceHistory(id, from, to);
    return history.map((entry) =>
      this.toDto(PriceObservationResponseDto, entry),
    );
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
    // Same wrap as findAll above — coerces price to a number and strips
    // nested relations through the @Expose() whitelist.
    return rows.map((row) => this.toDto(ProductResponseDto, row));
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
