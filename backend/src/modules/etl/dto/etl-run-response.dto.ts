import { Type } from 'class-transformer';
import {
  IsString,
  IsDate,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { EtlProductDto } from './etl-product.dto';
import { QualityMetricDto } from './quality-metric.dto';

/**
 * Response shape for `GET /api/etl/runs/latest`.
 *
 * Returns the most recent SUCCESS EtlRun with its products and the
 * run-level quality metric. Mirrors the Prisma EtlRun model
 * (`backend/prisma/schema.prisma:EtlRun`) but narrows the status
 * to SUCCESS — failed runs are never surfaced to the API.
 */
export enum EtlRunStatusDto {
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export class EtlRunResponseDto {
  @IsString()
  id!: string;

  @IsString()
  source!: string;

  @IsEnum(EtlRunStatusDto)
  status!: EtlRunStatusDto;

  @IsDate()
  startedAt!: Date;

  @IsOptional()
  @IsDate()
  finishedAt?: Date | null;

  @IsNumber()
  rowsScraped!: number;

  @IsNumber()
  rowsPersisted!: number;

  @IsOptional()
  @IsString()
  errorSummary?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EtlProductDto)
  etlProducts!: EtlProductDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => QualityMetricDto)
  qualityMetric?: QualityMetricDto | null;
}
