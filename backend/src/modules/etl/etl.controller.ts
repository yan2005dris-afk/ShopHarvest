import { Controller, Get, NotFoundException } from '@nestjs/common';
import { EtlService } from './etl.service';
import type { EtlRunResponseDto } from './dto';

/**
 * EtlController — `GET /api/etl/runs/latest`.
 *
 * The route is protected by the GLOBAL JwtAuthGuard (registered in
 * `backend/src/app.module.ts:30`). It does NOT carry @Public() so the guard
 * applies on every request — verified by `etl.controller.spec.ts`.
 */
@Controller('api/etl')
export class EtlController {
  constructor(private readonly etl: EtlService) {}

  @Get('runs/latest')
  async findLatest(): Promise<EtlRunResponseDto> {
    const run = await this.etl.findLatest();
    if (!run) {
      throw new NotFoundException('No successful ETL run found');
    }
    return run;
  }
}
