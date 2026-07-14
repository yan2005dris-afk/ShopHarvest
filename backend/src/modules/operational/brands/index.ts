export { BrandsModule } from './brands.module';
export { CreateBrandUseCase } from './application/create-brand.use-case';
export { DeleteBrandUseCase } from './application/delete-brand.use-case';
export { FindBrandUseCase } from './application/find-brand.use-case';
export { FuzzyMatchBrandsUseCase } from './application/fuzzy-match-brands.use-case';
export { ListBrandsUseCase } from './application/list-brands.use-case';
export { UpdateBrandUseCase } from './application/update-brand.use-case';
export { BRANDS_REPOSITORY } from './domain/brands.repository';
export type {
  BrandsRepository,
  FuzzyMatchCandidate,
  FuzzyMatchQuery,
} from './domain/brands.repository';
export { Brand } from './domain/brand.entity';
export type {
  BrandProps,
  CreateBrandInput,
  UpdateBrandInput,
} from './domain/brand.entity';
export {
  BrandNotFoundError,
  DuplicateBrandNameError,
} from './domain/brand.errors';
