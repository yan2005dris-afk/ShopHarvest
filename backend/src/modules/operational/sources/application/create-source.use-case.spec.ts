import { CreateSourceUseCase } from './create-source.use-case';
import { Source } from '../domain/source.entity';
import { DuplicateSourceCodeError } from '../domain/source.errors';
import { SourcesRepository } from '../domain/sources.repository';

describe('CreateSourceUseCase', () => {
  let useCase: CreateSourceUseCase;
  let repository: jest.Mocked<SourcesRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new CreateSourceUseCase(repository);
  });

  it('creates and persists a new source', async () => {
    repository.findByCode.mockResolvedValue(null);
    repository.save.mockImplementation(async (s: Source) => s);

    const result = await useCase.execute({
      code: 'ML_AR',
      name: 'Mercado Libre Argentina',
      baseUrl: 'https://www.mercadolibre.com.ar',
    });

    expect(repository.findByCode).toHaveBeenCalledWith('ML_AR');
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.code).toBe('ML_AR');
    expect(result.name).toBe('Mercado Libre Argentina');
    expect(result.baseUrl).toBe('https://www.mercadolibre.com.ar');
    expect(result.status).toBe('inactive');
    expect(result.config).toBeNull();
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('persists provided config', async () => {
    repository.findByCode.mockResolvedValue(null);
    repository.save.mockImplementation(async (s: Source) => s);

    const result = await useCase.execute({
      code: 'ML_AR',
      name: 'ML',
      baseUrl: 'https://ml.com.ar',
      config: { selector: 'h1' },
    });
    expect(result.config).toEqual({ selector: 'h1' });
  });

  it('throws DuplicateSourceCodeError when code already exists', async () => {
    const existing = Source.create({
      id: 'src_existing',
      code: 'ML_AR',
      name: 'Existing',
      baseUrl: 'https://ml.com.ar',
    });
    repository.findByCode.mockResolvedValue(existing);

    await expect(
      useCase.execute({
        code: 'ML_AR',
        name: 'New one',
        baseUrl: 'https://ml.com.ar',
      }),
    ).rejects.toBeInstanceOf(DuplicateSourceCodeError);

    expect(repository.save).not.toHaveBeenCalled();
  });
});
