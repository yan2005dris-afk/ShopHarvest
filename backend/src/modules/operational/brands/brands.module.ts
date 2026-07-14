import { Module } from '@nestjs/common';
import { CreateBrandUseCase } from './application/create-brand.use-case';
import { DeleteBrandUseCase } from './application/delete-brand.use-case';
import { FindBrandUseCase } from './application/find-brand.use-case';
import { FuzzyMatchBrandsUseCase } from './application/fuzzy-match-brands.use-case';
import { ListBrandsUseCase } from './application/list-brands.use-case';
import { UpdateBrandUseCase } from './application/update-brand.use-case';
import { BRANDS_REPOSITORY } from './domain/brands.repository';
import { BrandsHttpController } from './infrastructure/http/brands-http.controller';
import { PrismaBrandsRepository } from './infrastructure/persistence/prisma-brands.repository';

@Module({
  controllers: [BrandsHttpController],
  providers: [
    PrismaBrandsRepository,
    { provide: BRANDS_REPOSITORY, useExisting: PrismaBrandsRepository },
    CreateBrandUseCase,
    DeleteBrandUseCase,
    FindBrandUseCase,
    FuzzyMatchBrandsUseCase,
    ListBrandsUseCase,
    UpdateBrandUseCase,
  ],
  exports: [
    BRANDS_REPOSITORY,
    CreateBrandUseCase,
    DeleteBrandUseCase,
    FindBrandUseCase,
    FuzzyMatchBrandsUseCase,
    ListBrandsUseCase,
    UpdateBrandUseCase,
  ],
})
export class BrandsModule {}
