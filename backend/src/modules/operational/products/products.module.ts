import { Module } from '@nestjs/common';
import { DeleteProductUseCase } from './application/delete-product.use-case';
import { FindProductUseCase } from './application/find-product.use-case';
import { GetPriceHistoryUseCase } from './application/get-price-history.use-case';
import { IngestProductsUseCase } from './application/ingest-products.use-case';
import { ListProductsUseCase } from './application/list-products.use-case';
import { PRODUCTS_REPOSITORY } from './domain/products.repository';
import { ProductsHttpController } from './infrastructure/http/products-http.controller';
import { PrismaProductsRepository } from './infrastructure/persistence/prisma-products.repository';

@Module({
  controllers: [ProductsHttpController],
  providers: [
    PrismaProductsRepository,
    { provide: PRODUCTS_REPOSITORY, useExisting: PrismaProductsRepository },
    ListProductsUseCase,
    FindProductUseCase,
    GetPriceHistoryUseCase,
    IngestProductsUseCase,
    DeleteProductUseCase,
  ],
  exports: [
    PRODUCTS_REPOSITORY,
    ListProductsUseCase,
    FindProductUseCase,
    GetPriceHistoryUseCase,
    IngestProductsUseCase,
    DeleteProductUseCase,
  ],
})
export class ProductsModule {}
