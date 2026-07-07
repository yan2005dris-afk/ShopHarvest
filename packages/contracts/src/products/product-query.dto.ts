import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Wire shape for the `GET /products` query string.
 *
 * `includeHistory` accepts the string 'true' / 'false' from query params
 * (class-transformer coerces it to a real boolean) so the frontend can
 * pass `?includeHistory=false` without manual JSON serialization. A missing
 * query param stays `undefined` so the controller's `?? true` default
 * applies — coercing a missing param to `false` here would silently flip
 * the default and force every list call to skip `priceHistory` joins.
 */
export class ProductQueryDto {
  @ApiProperty({
    required: false,
    type: Boolean,
    description: 'When true, joins priceHistory on every row. Defaults to true.',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === undefined) return undefined;
    return value === 'true' || value === true;
  })
  includeHistory?: boolean;

  @ApiProperty({ required: false, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  domainRuleId?: string;
}
