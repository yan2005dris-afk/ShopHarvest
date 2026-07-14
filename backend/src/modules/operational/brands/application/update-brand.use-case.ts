import { Inject, Injectable } from '@nestjs/common';
import { Brand } from '../domain/brand.entity';
import {
  BrandNotFoundError,
  DuplicateBrandNameError,
} from '../domain/brand.errors';
import { BRANDS_REPOSITORY } from '../domain/brands.repository';
import type { BrandsRepository } from '../domain/brands.repository';

export interface UpdateBrandCommand {
  id: string;
  name?: string;
  aliases?: string[];
}

/**
 * Loads a brand, applies field changes on the aggregate, and persists it.
 * Rename conflicts are detected here (the domain defers uniqueness checks
 * upward so renaming can produce a clean error envelope upstream).
 */
@Injectable()
export class UpdateBrandUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY)
    private readonly repository: BrandsRepository,
  ) {}

  async execute(command: UpdateBrandCommand): Promise<Brand> {
    const brand = await this.repository.findById(command.id);
    if (!brand) {
      throw new BrandNotFoundError(command.id);
    }

    if (command.name !== undefined && command.name !== brand.name) {
      const conflict = await this.repository.findByName(command.name);
      if (conflict) {
        throw new DuplicateBrandNameError(command.name);
      }
    }

    brand.update({
      name: command.name,
      aliases: command.aliases,
    });
    return this.repository.save(brand);
  }
}
