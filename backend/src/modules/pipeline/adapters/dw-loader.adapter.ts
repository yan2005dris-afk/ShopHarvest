import { Injectable } from '@nestjs/common';
import type { IDwLoader, LoadResult } from '../interfaces';
import { DwLoaderService } from '../etl/dw-loader.service';

/**
 * DwLoaderAdapter — thin `IDwLoader` delegate to the native
 * `DwLoaderService`. Kept as a separate adapter class (rather than
 * binding the service directly to the token) so the `DW_LOADER` token
 * boundary stays swappable, matching the rest of the hexagonal
 * port/adapter layer.
 */
@Injectable()
export class DwLoaderAdapter implements IDwLoader {
  constructor(private readonly dwLoader: DwLoaderService) {}

  async load(opts?: { truncateFirst?: boolean }): Promise<LoadResult> {
    return this.dwLoader.load(opts);
  }
}
