import { Inject, Injectable } from '@nestjs/common';
import { Brand } from '../domain/brand.entity';
import { BRANDS_REPOSITORY } from '../domain/brands.repository';
import type { BrandsRepository } from '../domain/brands.repository';

/** Returns every persisted brand ordered as the repository decides. */
@Injectable()
export class ListBrandsUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY)
    private readonly repository: BrandsRepository,
  ) {}

  async execute(): Promise<Brand[]> {
    return this.repository.findAll();
  }
}
