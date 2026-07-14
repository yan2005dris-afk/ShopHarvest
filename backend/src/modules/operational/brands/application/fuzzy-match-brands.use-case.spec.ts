import { FuzzyMatchBrandsUseCase } from './fuzzy-match-brands.use-case';
import { Brand } from '../domain/brand.entity';
import { BrandsRepository } from '../domain/brands.repository';

describe('FuzzyMatchBrandsUseCase', () => {
  let useCase: FuzzyMatchBrandsUseCase;
  let repository: jest.Mocked<BrandsRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      fuzzyMatch: jest.fn(),
    };
    useCase = new FuzzyMatchBrandsUseCase(repository);
  });

  it('returns empty array for an empty query', async () => {
    const result = await useCase.execute({ query: '' });
    expect(result).toEqual([]);
    expect(repository.fuzzyMatch).not.toHaveBeenCalled();
  });

  it('returns empty array for whitespace-only query', async () => {
    const result = await useCase.execute({ query: '   ' });
    expect(result).toEqual([]);
    expect(repository.fuzzyMatch).not.toHaveBeenCalled();
  });

  it('trims query before delegating', async () => {
    repository.fuzzyMatch.mockResolvedValue([]);
    await useCase.execute({ query: '  Samsung  ' });
    expect(repository.fuzzyMatch).toHaveBeenCalledWith({
      query: 'Samsung',
      threshold: undefined,
    });
  });

  it('passes threshold through to the repository', async () => {
    repository.fuzzyMatch.mockResolvedValue([]);
    await useCase.execute({ query: 'Sam', threshold: 0.8 });
    expect(repository.fuzzyMatch).toHaveBeenCalledWith({
      query: 'Sam',
      threshold: 0.8,
    });
  });

  it('forwards repository candidates untouched', async () => {
    const samsung = Brand.create({ id: 'brd_1', name: 'Samsung' });
    const candidates = [
      {
        brand: samsung,
        similarity: 0.92,
        lowConfidence: false,
      },
    ];
    repository.fuzzyMatch.mockResolvedValue(candidates);

    const result = await useCase.execute({ query: 'Samsung', threshold: 0.6 });
    expect(result).toEqual(candidates);
  });
});
