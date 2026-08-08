import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorResponseDto } from '@web-scraping/contracts/errors';
import {
  IngestProductsDto,
  PriceObservationResponseDto,
  ProductListResponseDto,
  ProductQueryDto,
  ProductResponseDto,
} from '@web-scraping/contracts/products';
import { DeleteProductUseCase } from '../../application/delete-product.use-case';
import { FindProductUseCase } from '../../application/find-product.use-case';
import { GetPriceHistoryUseCase } from '../../application/get-price-history.use-case';
import { IngestProductsUseCase } from '../../application/ingest-products.use-case';
import type { IngestResult } from '../../domain/products.repository';
import { ListProductsUseCase } from '../../application/list-products.use-case';
import { ProductNotFoundError } from '../../domain/product.errors';
import { ProductResponseMapper } from './product-response.mapper';

function mapDomainError(error: unknown): HttpException {
  if (error instanceof ProductNotFoundError) {
    return new NotFoundException(error.message);
  }
  throw error as Error;
}

@ApiTags('Products')
@Controller('products')
export class ProductsHttpController {
  constructor(
    @Inject(ListProductsUseCase)
    private readonly listUseCase: ListProductsUseCase,
    @Inject(FindProductUseCase)
    private readonly findUseCase: FindProductUseCase,
    @Inject(GetPriceHistoryUseCase)
    private readonly getPriceHistoryUseCase: GetPriceHistoryUseCase,
    @Inject(IngestProductsUseCase)
    private readonly ingestUseCase: IngestProductsUseCase,
    @Inject(DeleteProductUseCase)
    private readonly deleteUseCase: DeleteProductUseCase,
  ) {}

  @ApiOperation({
    summary: 'List extracted products with pagination and search',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'domainRuleId', required: false, type: String })
  @ApiResponse({ status: 200, type: ProductListResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @Get()
  async findAll(
    @Query() query: ProductQueryDto,
  ): Promise<ProductListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;

    const { items, total } = await this.listUseCase.execute({
      page,
      limit,
      q: query.q,
    });

    const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

    return {
      data: items.map((product) => ProductResponseMapper.toDto(product)),
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  @ApiOperation({
    summary: 'Ingest a batch of products extracted by the browser extension',
  })
  @ApiResponse({
    status: 201,
    description: 'Ingest summary',
    schema: {
      type: 'object',
      properties: {
        ingested: { type: 'number', example: 12 },
        domainRuleId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @Post('ingest')
  async ingestFromExtension(
    @Body() dto: IngestProductsDto,
  ): Promise<IngestResult> {
    return this.ingestUseCase.execute(dto);
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
  async findOne(@Param('id') id: string): Promise<ProductResponseDto> {
    try {
      const product = await this.findUseCase.execute(id);
      return ProductResponseMapper.toDto(product);
    } catch (error) {
      throw mapDomainError(error);
    }
  }

  @ApiOperation({
    summary: 'Get the price history for a product, across all its offers',
  })
  @ApiResponse({
    status: 200,
    type: PriceObservationResponseDto,
    isArray: true,
  })
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
  ): Promise<PriceObservationResponseDto[]> {
    const range = {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };
    try {
      const history = await this.getPriceHistoryUseCase.execute(id, range);
      return history.map((entry) =>
        ProductResponseMapper.priceObservationToDto(entry),
      );
    } catch (error) {
      throw mapDomainError(error);
    }
  }

  @ApiOperation({ summary: 'List products scoped to a single domain rule' })
  @ApiResponse({ status: 200, type: ProductResponseDto, isArray: true })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'Validation failed',
  })
  @Get('by-domain/:domainRuleId')
  async findByDomain(
    @Param('domainRuleId') domainRuleId: string,
  ): Promise<ProductResponseDto[]> {
    const products = await this.listUseCase.findAllByDomainRule(domainRuleId);
    return products.map((product) => ProductResponseMapper.toDto(product));
  }

  @ApiOperation({ summary: 'Delete a product' })
  @ApiResponse({
    status: 200,
    description: 'Product deleted',
  })
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
  async remove(@Param('id') id: string): Promise<{ deleted: true }> {
    try {
      await this.deleteUseCase.execute(id);
    } catch (error) {
      throw mapDomainError(error);
    }
    return { deleted: true };
  }
}
