import { IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class ProductQueryDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeHistory?: boolean;

  @IsOptional()
  @IsUUID()
  domainRuleId?: string;
}
