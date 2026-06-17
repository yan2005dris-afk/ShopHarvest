import { IsUUID, IsUrl, IsOptional, IsInt, Min, Max } from 'class-validator';

export class ScrapeListingDto {
  @IsUUID()
  domainRuleId!: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
