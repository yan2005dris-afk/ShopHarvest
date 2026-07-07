/**
 * Root barrel — re-exports every module.
 *
 * Consumer import patterns:
 *   import { LoginDto, RegisterDto } from '@web-scraping/contracts/auth';
 *   import { CreateDomainDto } from '@web-scraping/contracts/domains';
 *   import { ProductResponseDto } from '@web-scraping/contracts/products';
 *   import { ErrorResponseDto } from '@web-scraping/contracts/errors';
 */
export * from './auth/index.js';
export * from './domains/index.js';
export * from './products/index.js';
export * from './errors/index.js';
