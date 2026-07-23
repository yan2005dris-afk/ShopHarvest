import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { BrandResponseDto } from '../brand-response.dto';

describe('BrandResponseDto (@Expose whitelist)', () => {
  it('exposes decorated fields and strips non-decorated ones', () => {
    const raw = {
      id: 'brand-1',
      name: 'Samsung',
      aliases: ['Sam', 'SSG'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      internalScore: 999,
    };
    const dto = plainToInstance(BrandResponseDto, raw, {
      excludeExtraneousValues: true,
    }) as unknown as Record<string, unknown>;

    expect(dto.id).toBe('brand-1');
    expect(dto.name).toBe('Samsung');
    expect(dto.aliases).toEqual(['Sam', 'SSG']);
    expect(dto).not.toHaveProperty('internalScore');
  });
});
