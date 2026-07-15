export { ProductsModule } from './products.module';
export { ListProductsUseCase } from './application/list-products.use-case';
export { FindProductUseCase } from './application/find-product.use-case';
export { GetPriceHistoryUseCase } from './application/get-price-history.use-case';
export { IngestProductsUseCase } from './application/ingest-products.use-case';
export { DeleteProductUseCase } from './application/delete-product.use-case';
export { PRODUCTS_REPOSITORY } from './domain/products.repository';
export type {
  IngestCommand,
  IngestItem,
  IngestResult,
  ProductLoadOptions,
  ProductsRepository,
} from './domain/products.repository';
export { Product } from './domain/product.entity';
export type {
  CreateProductInput,
  ProductProps,
  UpdateProductInput,
} from './domain/product.entity';
export { Offer } from './domain/offer.entity';
export type {
  CreateOfferInput,
  OfferProps,
  UpdateOfferInput,
} from './domain/offer.entity';
export { PriceObservation } from './domain/price-observation.entity';
export type {
  CreatePriceObservationInput,
  PriceObservationProps,
} from './domain/price-observation.entity';
export { ProductNotFoundError } from './domain/product.errors';
