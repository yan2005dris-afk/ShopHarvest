import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { CategoryResponseDto } from '../category-response.dto';

describe('CategoryResponseDto (@Expose whitelist)', () => {
  it('exposes decorated fields and strips non-decorated ones', () => {
    const raw = {
      id: 'cat-1',
      name: 'Celulares',
      path: '/cat-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      internalNotes: 'should-not-leak',
    };
    const dto = plainToInstance(CategoryResponseDto, raw, {
      excludeExtraneousValues: true,
    }) as unknown as Record<string, unknown>;

    expect(dto.id).toBe('cat-1');
    expect(dto.name).toBe('Celulares');
    expect(dto.path).toBe('/cat-1');
    expect(dto).not.toHaveProperty('internalNotes');
  });
});
