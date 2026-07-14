import { FindSourceUseCase } from './find-source.use-case';
import { Source } from '../domain/source.entity';
import { SourceNotFoundError } from '../domain/source.errors';
import { SourcesRepository } from '../domain/sources.repository';

describe('FindSourceUseCase', () => {
  let useCase: FindSourceUseCase;
  let repository: jest.Mocked<SourcesRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new FindSourceUseCase(repository);
  });

  it('returns the source when found', async () => {
    const source = Source.create({
      id: 'src_1',
      code: 'ML_AR',
      name: 'ML',
      baseUrl: 'https://ml.com.ar',
    });
    repository.findById.mockResolvedValue(source);

    const result = await useCase.execute('src_1');
    expect(result).toBe(source);
    expect(repository.findById).toHaveBeenCalledWith('src_1');
  });

  it('throws SourceNotFoundError when missing', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      SourceNotFoundError,
    );
  });
});
