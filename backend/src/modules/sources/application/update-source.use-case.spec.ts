import { UpdateSourceUseCase } from './update-source.use-case';
import { Source } from '../domain/source.entity';
import {
  InvalidSourceStatusTransitionError,
  SourceNotFoundError,
} from '../domain/source.errors';
import { SourcesRepository } from '../domain/sources.repository';

describe('UpdateSourceUseCase', () => {
  let useCase: UpdateSourceUseCase;
  let repository: jest.Mocked<SourcesRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    useCase = new UpdateSourceUseCase(repository);
  });

  it('updates fields and persists the source', async () => {
    const source = Source.create({
      id: 'src_1',
      code: 'ML_AR',
      name: 'Old',
      baseUrl: 'https://old.example.com',
    });
    repository.findById.mockResolvedValue(source);
    repository.save.mockImplementation(async (s: Source) => s);

    const result = await useCase.execute({
      id: 'src_1',
      name: 'New name',
      baseUrl: 'https://new.example.com',
    });

    expect(result.name).toBe('New name');
    expect(result.baseUrl).toBe('https://new.example.com');
    expect(repository.save).toHaveBeenCalledWith(source);
  });

  it('transitions status when transition is valid', async () => {
    const source = Source.create({
      id: 'src_1',
      code: 'ML_AR',
      name: 'ML',
      baseUrl: 'https://ml.com.ar',
    });
    repository.findById.mockResolvedValue(source);
    repository.save.mockImplementation(async (s: Source) => s);

    const result = await useCase.execute({ id: 'src_1', status: 'active' });
    expect(result.status).toBe('active');
  });

  it('throws SourceNotFoundError when id does not exist', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(
      useCase.execute({ id: 'missing', name: 'X' }),
    ).rejects.toBeInstanceOf(SourceNotFoundError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('throws InvalidSourceStatusTransitionError on illegal transition', async () => {
    const source = Source.create({
      id: 'src_1',
      code: 'ML_AR',
      name: 'ML',
      baseUrl: 'https://ml.com.ar',
    });
    repository.findById.mockResolvedValue(source);

    await expect(
      useCase.execute({ id: 'src_1', status: 'error' }),
    ).rejects.toBeInstanceOf(InvalidSourceStatusTransitionError);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
