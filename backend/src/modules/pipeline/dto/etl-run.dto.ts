import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsDateString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import type { EtlRunStatus } from '@web-scraping/contracts/pipeline';

/**
 * Query params for GET /pipeline/etl-runs.
 */
export class ListEtlRunsQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['RUNNING', 'SUCCESS', 'FAILED'] })
  @IsOptional()
  @IsString()
  status?: EtlRunStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'ISO date string for lower bound' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date string for upper bound' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

/**
 * Request body for POST /pipeline/etl-runs/trigger.
 */
export class TriggerEtlRunDto {
  @ApiPropertyOptional({ enum: ['full', 'local'], default: 'full' })
  @IsOptional()
  @IsString()
  action?: 'full' | 'local' = 'full';

  @ApiPropertyOptional({ default: 'all' })
  @IsOptional()
  @IsString()
  source?: string = 'all';
}

/**
 * Single ETL run response shape used with plainToInstance.
 */
export class EtlRunResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  source!: string;

  @ApiProperty({ enum: ['RUNNING', 'SUCCESS', 'FAILED'] })
  status!: EtlRunStatus;

  @ApiProperty()
  startedAt!: string;

  @ApiProperty({ nullable: true })
  finishedAt!: string | null;

  @ApiProperty()
  rowsScraped!: number;

  @ApiProperty()
  rowsPersisted!: number;

  @ApiProperty({ nullable: true })
  durationMs!: number | null;

  @ApiProperty({ nullable: true })
  errorSummary!: string | null;
}

/**
 * Paginated response for GET /pipeline/etl-runs.
 */
export class EtlRunListResponseDto {
  @ApiProperty({ type: EtlRunResponseDto, isArray: true })
  data!: EtlRunResponseDto[];

  @ApiProperty({
    example: { page: 1, limit: 20, total: 42, totalPages: 3 },
  })
  meta!: { page: number; limit: number; total: number; totalPages: number };
}
