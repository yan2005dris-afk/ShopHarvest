import { DeleteSourceUseCase } from './delete-source.use-case';
import { Source } from '../domain/source.entity';
import { SourceNotFoundError } from '../domain/source.errors';
import { SourcesRepository } from '../domain/sources.repository';

describe('DeleteSourceUseCase', () => {
  let useCase: DeleteSourceUseCase;
  let repository: jest.Mocked<SourcesRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new DeleteSourceUseCase(repository);
  });

  it('deletes the source when it exists', async () => {
    const source = Source.create({
      id: 'src_1',
      code: 'ML_AR',
      name: 'ML',
      baseUrl: 'https://ml.com.ar',
    });
    repository.findById.mockResolvedValue(source);
    repository.delete.mockResolvedValue(undefined);

    await useCase.execute('src_1');
    expect(repository.findById).toHaveBeenCalledWith('src_1');
    expect(repository.delete).toHaveBeenCalledWith('src_1');
  });

  it('throws SourceNotFoundError when source does not exist', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      SourceNotFoundError,
    );
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
