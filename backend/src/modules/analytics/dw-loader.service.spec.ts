import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DW_LOADER } from '@web-scraping/contracts/pipeline';
import type { IDwLoader, LoadResult } from '../pipeline/interfaces';
import { DwLoaderService } from './dw-loader.service';

/**
 * RED-first spec for DwLoaderService (post-refactor).
 *
 * Previously this service held the ETL inline. After the Ports &
 * Adapters refactor the canonical implementation lives in
 * `DwLoaderAdapter` (registered as `DW_LOADER`); this service is a
 * thin facade that delegates. The spec now asserts:
 *
 *   - run() delegates to IDwLoader.load() with truncateFirst mapping
 *   - the camelCase→snake_case envelope mapping preserves the
 *     controller contract unchanged
 *   - errors from the adapter are surfaced as the `{ estado:
 *     'fallido', error }` envelope
 */
describe('DwLoaderService (thin wrapper around IDwLoader)', () => {
  let service: DwLoaderService;
  let dwLoaderMock: jest.Mocked<IDwLoader>;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(async () => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    dwLoaderMock = {
      load: jest.fn(),
    } as unknown as jest.Mocked<IDwLoader>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DwLoaderService,
        { provide: DW_LOADER, useValue: dwLoaderMock },
      ],
    }).compile();

    service = moduleRef.get(DwLoaderService);
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('delegates run({ truncate_first: true }) to dwLoader.load({ truncateFirst: true })', async () => {
    const loadResult: LoadResult = {
      productosCargados: 164,
      encuestasCargadas: 24,
      tiempoMs: 932,
      estado: 'completado',
    };
    dwLoaderMock.load.mockResolvedValueOnce(loadResult);

    const result = await service.run({ truncate_first: true });

    expect(dwLoaderMock.load).toHaveBeenCalledWith({ truncateFirst: true });
    expect(result.estado).toBe('completado');
    if (result.estado === 'completado') {
      // snake_case envelope preserved for AnalyticsController.load
      expect(result.productos_cargados).toBe(164);
      expect(result.encuestas_cargadas).toBe(24);
      expect(result.tiempo_ms).toBe(932);
    }
  });

  it('defaults truncateFirst to false when not provided', async () => {
    dwLoaderMock.load.mockResolvedValueOnce({
      productosCargados: 0,
      encuestasCargadas: 0,
      tiempoMs: 0,
      estado: 'completado',
    });
    await service.run();
    expect(dwLoaderMock.load).toHaveBeenCalledWith({ truncateFirst: false });
  });

  it('surfaces adapter errors via the { estado: "fallido" } envelope', async () => {
    dwLoaderMock.load.mockResolvedValueOnce({
      productosCargados: 0,
      encuestasCargadas: 0,
      tiempoMs: 0,
      estado: 'fallido',
      error: 'connection refused',
    });
    const result = await service.run({ truncate_first: false });
    expect(result.estado).toBe('fallido');
    if (result.estado === 'fallido') {
      expect(result.error).toBe('connection refused');
    }
  });
});
