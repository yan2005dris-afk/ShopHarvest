import { Inject, Injectable } from '@nestjs/common';
import { ProductNotFoundError } from '../domain/product.errors';
import {
  PRODUCTS_REPOSITORY,
  type Product,
  type ProductLoadOptions,
  type ProductsRepository,
} from '../domain/products.repository';

/**
 * Returns the Product with the given id, throwing
 * `ProductNotFoundError` when it does not exist. Used by the HTTP
 * handlers that target a specific resource (`GET /:id`,
 * `GET /:id/history`, `DELETE /:id`).
 */
@Injectable()
export class FindProductUseCase {
  constructor(
    @Inject(PRODUCTS_REPOSITORY)
    private readonly repository: ProductsRepository,
  ) {}

  async execute(
    id: string,
    options: ProductLoadOptions = { includeHistory: true },
  ): Promise<Product> {
    const product = await this.repository.findById(id, options);
    if (!product) {
      throw new ProductNotFoundError(id);
    }
    return product;
  }
}
