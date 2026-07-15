import { Inject, Injectable } from '@nestjs/common';
import { FindProductUseCase } from './find-product.use-case';
import {
  PRODUCTS_REPOSITORY,
  type ProductsRepository,
} from '../domain/products.repository';

/**
 * Hard-deletes a product by id. Pre-validates the row exists so callers
 * get `ProductNotFoundError` (→ 404) instead of a leaking Prisma P2025.
 */
@Injectable()
export class DeleteProductUseCase {
  constructor(
    @Inject(PRODUCTS_REPOSITORY)
    private readonly repository: ProductsRepository,
    private readonly findProductUseCase: FindProductUseCase,
  ) {}

  async execute(id: string): Promise<void> {
    // Existence guard preserves the legacy `if (!product) throw` path.
    // The actual fetch is shipped without offers to keep the pre-check
    // cheap.
    await this.findProductUseCase.execute(id, { includeHistory: false });
    await this.repository.delete(id);
  }
}
