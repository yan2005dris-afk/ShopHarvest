import { Inject, Injectable } from '@nestjs/common';
import { BrandNotFoundError } from '../domain/brand.errors';
import { BRANDS_REPOSITORY } from '../domain/brands.repository';
import type { BrandsRepository } from '../domain/brands.repository';

/** Deletes a brand by id, throwing BrandNotFoundError if it doesn't exist. */
@Injectable()
export class DeleteBrandUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY)
    private readonly repository: BrandsRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const brand = await this.repository.findById(id);
    if (!brand) {
      throw new BrandNotFoundError(id);
    }
    await this.repository.delete(id);
  }
}
