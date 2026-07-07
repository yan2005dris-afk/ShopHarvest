# @web-scraping/contracts

Shared DTOs and types for the WebScrapingDinamico monorepo.

## Purpose

A pure type-only package consumed by both the NestJS backend and the Angular frontend. Contains request/response DTOs and cross-cutting error types so the API surface is defined in one place.

## Rules

- This package MUST NOT import from `backend/`, `frontend/`, or any other monorepo package.
- Decorators (`@IsString`, `@ApiProperty`, `@Expose`, `@Type`) belong here, not on consumer-side wrappers.
- ESM only. Consumers resolve sub-paths (`@web-scraping/contracts/auth`, `@web-scraping/contracts/domains`, etc.).

## Public surface

| Sub-path | Contents |
|----------|----------|
| `@web-scraping/contracts` | Root barrel — re-exports `auth`, `domains`, `products`, `errors`. |
| `@web-scraping/contracts/auth` | Auth request/response DTOs (`LoginDto`, `RegisterDto`, `AuthResponseDto`). |
| `@web-scraping/contracts/domains` | Domain rule request/response DTOs. (slice 2) |
| `@web-scraping/contracts/products` | Product request/response DTOs. (slice 2) |
| `@web-scraping/contracts/errors` | Standard error response DTO. (slice 3) |

## Build

```bash
pnpm --filter @web-scraping/contracts build
```

Emits `dist/` with `.js` + `.d.ts` + source maps.