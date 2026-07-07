import { IsNumber, IsObject, IsDate, IsOptional, IsString } from 'class-validator';

/**
 * Shape of a QualityMetric inside the latest-run response.
 * Mirrors `backend/prisma/schema.prisma:QualityMetric` (PR 1).
 */
export class QualityMetricDto {
  @IsString()
  id!: string;

  @IsNumber()
  completenessPct!: number;

  @IsNumber()
  duplicatesRemoved!: number;

  @IsObject()
  checks!: Record<string, { passed: number; failed: number }>;

  @IsOptional()
  @IsDate()
  createdAt?: Date;
}
