import { IsUUID, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateScheduleDto {
  @IsUUID()
  domainRuleId!: string;

  @IsString()
  cronExpression!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
