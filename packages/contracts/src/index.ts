/**
 * Root barrel — re-exports every module.
 *
 * Consumer import patterns:
 *   import { LoginDto, RegisterDto } from '@web-scraping/contracts/auth';
 *   import { CreateDomainDto } from '@web-scraping/contracts/domains';
 *   import { ProductResponseDto } from '@web-scraping/contracts/products';
 *   import { ErrorResponseDto } from '@web-scraping/contracts/errors';
 *   import { SourceResponseDto } from '@web-scraping/contracts/sources';
 *   import { CategoryResponseDto } from '@web-scraping/contracts/categories';
 *   import { BrandResponseDto } from '@web-scraping/contracts/brands';
 *   import { RawCaptureResponseDto } from '@web-scraping/contracts/raw-captures';
 */
export * from './auth/index.js';
export * from './domains/index.js';
export * from './products/index.js';
export * from './errors/index.js';
export * from './sources/index.js';
export * from './categories/index.js';
export * from './brands/index.js';
export * from './raw-captures/index.js';
