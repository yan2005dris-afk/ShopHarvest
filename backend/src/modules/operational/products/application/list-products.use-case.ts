import { Inject, Injectable } from '@nestjs/common';
import {
  PRODUCTS_REPOSITORY,
  type Product,
  type ProductsRepository,
} from '../domain/products.repository';

/**
 * Returns every persisted Product. The optional `includeHistory` flag
 * mirrors the legacy `?includeHistory=` query parameter and joins
 * `PriceObservation[]` on every offer when true (the frontend in-line
 * price sparkline default).
 */
@Injectable()
export class ListProductsUseCase {
  constructor(
    @Inject(PRODUCTS_REPOSITORY)
    private readonly repository: ProductsRepository,
  ) {}

  async execute(
    includeHistory: boolean = true,
  ): Promise<Product[]> {
    return this.repository.findAll({ includeHistory });
  }

  async findAllByDomainRule(domainRuleId: string): Promise<Product[]> {
    return this.repository.findAllByDomainRule(domainRuleId);
  }
}
