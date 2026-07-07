import { IsString, IsNumber, IsOptional, IsObject, IsDate } from 'class-validator';

/**
 * Shape of an EtlProduct inside the latest-run response.
 * Mirrors `backend/prisma/schema.prisma:EtlProduct` (PR 1).
 */
export class EtlProductDto {
  @IsString()
  id!: string;

  @IsString()
  source!: string;

  @IsString()
  sourceId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsNumber()
  price?: number | null;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  availability?: string | null;

  @IsObject()
  rawJson!: Record<string, unknown>;

  @IsDate()
  scrapedAt!: Date;
}
