import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Input for `POST /api/analytics/load` (the staging → DW ETL trigger).
 *
 * The endpoint is intentionally minimal: the source files
 * (`backend/pipeline/staging/all_products_clean.json` and
 * `backend/pipeline/staging/stg_encuesta_clean.json`) are loaded from disk
 * by `DwLoaderService` so the dashboard can rebuild the DW without
 * manually running the CLI script.
 *
 * @see docs/PLAN_Entregable5_Dashboard_Reporte.md §4.5 (auditabilidad).
 */
export class LoadDwDto {
  @ApiProperty({
    type: Boolean,
    required: false,
    default: false,
    description:
      'When true, clears the existing dw.fact_* tables before reloading. ' +
      'Intended for local/dev refresh only; production callers should keep it false.',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === undefined ? false : value === true || value === 'true',
  )
  truncate_first?: boolean;
}