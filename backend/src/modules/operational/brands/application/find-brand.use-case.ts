import { Inject, Injectable } from '@nestjs/common';
import { Brand } from '../domain/brand.entity';
import { BrandNotFoundError } from '../domain/brand.errors';
import { BRANDS_REPOSITORY } from '../domain/brands.repository';
import type { BrandsRepository } from '../domain/brands.repository';

/** Returns the brand with the given id, or throws BrandNotFoundError. */
@Injectable()
export class FindBrandUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY)
    private readonly repository: BrandsRepository,
  ) {}

  async execute(id: string): Promise<Brand> {
    const brand = await this.repository.findById(id);
    if (!brand) {
      throw new BrandNotFoundError(id);
    }
    return brand;
  }
}
