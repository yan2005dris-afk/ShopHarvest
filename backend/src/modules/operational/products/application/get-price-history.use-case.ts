import { Inject, Injectable } from '@nestjs/common';
import { FindProductUseCase } from './find-product.use-case';
import {
  PRODUCTS_REPOSITORY,
  type PriceObservation,
  type ProductsRepository,
} from '../domain/products.repository';

export interface PriceHistoryRange {
  from?: Date;
  to?: Date;
}

/**
 * Returns the price history for a product, across all of its offers.
 *
 * Spec: "Price History Retrieval Across Offers" — each entry still
 * carries its own `offerId` so multi-offer products keep a
 * per-attribution series instead of merging into one undifferentiated
 * stream.
 *
 * Pre-validates the product exists (`ProductNotFoundError` → 404) before
 * hitting the price observations table so the legacy `findOne + null`
 * path is preserved.
 */
@Injectable()
export class GetPriceHistoryUseCase {
  constructor(
    @Inject(PRODUCTS_REPOSITORY)
    private readonly repository: ProductsRepository,
    private readonly findProductUseCase: FindProductUseCase,
  ) {}

  async execute(
    productId: string,
    range?: PriceHistoryRange,
  ): Promise<PriceObservation[]> {
    // Existence check mirrors the legacy `if (!product) throw new
    // NotFoundException(...)`. We pass `{ includeHistory: false }` to
    // avoid joining priceObservations twice (once here for the
    // existence check, once via `findPriceHistory` for the actual
    // series).
    await this.findProductUseCase.execute(productId, {
      includeHistory: false,
    });
    return this.repository.findPriceHistory(productId, range);
  }
}
