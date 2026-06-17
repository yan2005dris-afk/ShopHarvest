import { IsOptional, IsString, IsBoolean, IsUUID } from 'class-validator';

export class UpdateScheduleDto {
  @IsOptional()
  @IsUUID()
  domainRuleId?: string;

  @IsOptional()
  @IsString()
  cronExpression?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
