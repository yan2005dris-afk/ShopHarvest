import { Inject, Injectable } from '@nestjs/common';
import {
  PRODUCTS_REPOSITORY,
  type Product,
  type ProductsRepository,
} from '../domain/products.repository';

export interface ListProductsQuery {
  page?: number;
  limit?: number;
  q?: string;
}

/**
 * Returns paginated Products with total matching count.
 */
@Injectable()
export class ListProductsUseCase {
  constructor(
    @Inject(PRODUCTS_REPOSITORY)
    private readonly repository: ProductsRepository,
  ) {}

  async execute(query: ListProductsQuery = {}): Promise<{ items: Product[]; total: number }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 24));
    const q = query.q?.trim();
    const cleanQ = q && q.length >= 2 ? q : undefined;

    return this.repository.findAll({ page, limit, q: cleanQ });
  }

  async findAllByDomainRule(domainRuleId: string): Promise<Product[]> {
    return this.repository.findAllByDomainRule(domainRuleId);
  }
}
