import { IsUUID, IsOptional, IsUrl } from 'class-validator';

export class CreateScrapingJobDto {
  @IsUUID()
  domainRuleId!: string;

  @IsOptional()
  @IsUrl()
  url?: string;
}
