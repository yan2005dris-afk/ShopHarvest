import { CreateDomainUseCase } from './create-domain.use-case';
import { DomainRule } from '../domain/domain.entity';
import { DomainCategoryNotFoundError } from '../domain/domain.errors';
import type { DomainRuleLoadResult } from '../domain/domains.repository';
import { DomainsRepository } from '../domain/domains.repository';

const buildLoadResult = (
  id: string,
  categoryName: string | null,
): DomainRuleLoadResult => ({
  rule: DomainRule.create({
    id,
    domain: 'temu.com',
    name: 'Temu',
  }),
  categoryName,
});

describe('CreateDomainUseCase', () => {
  let useCase: CreateDomainUseCase;
  let repository: jest.Mocked<DomainsRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      categoryExists: jest.fn(),
    };
    useCase = new CreateDomainUseCase(repository);
  });

  it('persists a new DomainRule and returns the enriched load result', async () => {
    repository.categoryExists.mockResolvedValue(true);
    repository.save.mockImplementation(
      async (rule: DomainRule): Promise<DomainRuleLoadResult> => ({
        rule,
        categoryName: 'Electronics',
      }),
    );

    const result = await useCase.execute({
      domain: 'temu.com',
      name: 'Temu',
      categoryId: 'cat_electronics',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      containerSelector: '.product-card',
      productLimit: 50,
      sampleUrl: 'https://www.temu.com/category-1.html',
    });

    expect(repository.categoryExists).toHaveBeenCalledWith('cat_electronics');
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.rule.domain).toBe('temu.com');
    expect(result.rule.name).toBe('Temu');
    expect(result.rule.categoryId).toBe('cat_electronics');
    expect(result.rule.fieldMappings).toEqual([
      { canonicalField: 'title', selector: '.t', type: 'text' },
    ]);
    expect(result.rule.containerSelector).toBe('.product-card');
    expect(result.rule.productLimit).toBe(50);
    expect(result.rule.sampleUrl).toBe('https://www.temu.com/category-1.html');
    expect(result.rule.paginationType).toBe('scroll');
    expect(result.categoryName).toBe('Electronics');
  });

  it('skips the category existence check when categoryId is undefined', async () => {
    repository.save.mockImplementation(
      async (rule: DomainRule): Promise<DomainRuleLoadResult> => ({
        rule,
        categoryName: null,
      }),
    );

    await useCase.execute({
      domain: 'temu.com',
      name: 'Temu',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
    });

    expect(repository.categoryExists).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('skips the category existence check when categoryId is null', async () => {
    repository.save.mockImplementation(
      async (rule: DomainRule): Promise<DomainRuleLoadResult> => ({
        rule,
        categoryName: null,
      }),
    );

    await useCase.execute({
      domain: 'temu.com',
      name: 'Temu',
      categoryId: null,
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
    });

    expect(repository.categoryExists).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('throws DomainCategoryNotFoundError when categoryId does not exist', async () => {
    repository.categoryExists.mockResolvedValue(false);

    await expect(
      useCase.execute({
        domain: 'temu.com',
        name: 'Temu',
        categoryId: 'cat_missing',
        fieldMappings: [
          { canonicalField: 'title', selector: '.t', type: 'text' },
        ],
      }),
    ).rejects.toBeInstanceOf(DomainCategoryNotFoundError);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('mints a UUID for new rules', async () => {
    repository.save.mockImplementation(
      async (rule: DomainRule): Promise<DomainRuleLoadResult> => ({
        rule,
        categoryName: null,
      }),
    );

    const result = await useCase.execute({
      domain: 'temu.com',
      name: 'Temu',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
    });

    expect(result.rule.id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('respects an explicit paginationType override', async () => {
    repository.save.mockImplementation(
      async (rule: DomainRule): Promise<DomainRuleLoadResult> => ({
        rule,
        categoryName: null,
      }),
    );

    const result = await useCase.execute({
      domain: 'temu.com',
      name: 'Temu',
      fieldMappings: [
        { canonicalField: 'title', selector: '.t', type: 'text' },
      ],
      paginationType: 'page-number',
    });

    expect(result.rule.paginationType).toBe('page-number');
  });
});
