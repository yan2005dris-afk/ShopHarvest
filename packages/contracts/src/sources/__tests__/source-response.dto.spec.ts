import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { SourceResponseDto } from '../source-response.dto';

describe('SourceResponseDto (@Expose whitelist)', () => {
  it('exposes decorated fields and strips non-decorated ones', () => {
    const raw = {
      id: 'src-1',
      code: 'ML_AR',
      name: 'Mercado Libre Argentina',
      baseUrl: 'https://www.mercadolibre.com.ar',
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      internalSecret: 'should-not-leak',
    };
    const dto = plainToInstance(SourceResponseDto, raw, {
      excludeExtraneousValues: true,
    }) as Record<string, unknown>;

    expect(dto.id).toBe('src-1');
    expect(dto.code).toBe('ML_AR');
    expect(dto.name).toBe('Mercado Libre Argentina');
    expect(dto.baseUrl).toBe('https://www.mercadolibre.com.ar');
    expect(dto.status).toBe('active');
    expect(dto).not.toHaveProperty('internalSecret');
  });
});
