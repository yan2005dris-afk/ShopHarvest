import { IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Wire shape for the `GET /products` query string.
 *
 * `includeHistory` accepts the string 'true' / 'false' from query params
 * (class-transformer coerces it to a real boolean) so the frontend can
 * pass `?includeHistory=false` without manual JSON serialization.
 *
 * Note: @ApiProperty decorators are intentionally omitted — Swagger /
 * OpenAPI metadata is deferred to Slice 3.
 */
export class ProductQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeHistory?: boolean;

  @IsOptional()
  @IsUUID()
  domainRuleId?: string;
}