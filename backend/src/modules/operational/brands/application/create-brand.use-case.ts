import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Brand } from '../domain/brand.entity';
import { DuplicateBrandNameError } from '../domain/brand.errors';
import { BRANDS_REPOSITORY } from '../domain/brands.repository';
import type { BrandsRepository } from '../domain/brands.repository';

export interface CreateBrandCommand {
  name: string;
  aliases?: string[];
}

/** Creates a new brand after enforcing name uniqueness. */
@Injectable()
export class CreateBrandUseCase {
  constructor(
    @Inject(BRANDS_REPOSITORY)
    private readonly repository: BrandsRepository,
  ) {}

  async execute(command: CreateBrandCommand): Promise<Brand> {
    const existing = await this.repository.findByName(command.name);
    if (existing) {
      throw new DuplicateBrandNameError(command.name);
    }
    const brand = Brand.create({
      id: randomUUID(),
      name: command.name,
      aliases: command.aliases ?? [],
    });
    return this.repository.save(brand);
  }
}
