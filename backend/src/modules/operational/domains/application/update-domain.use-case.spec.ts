import { UpdateDomainUseCase } from './update-domain.use-case';
import { DomainRule } from '../domain/domain.entity';
import {
  DomainCategoryNotFoundError,
  DomainRuleNotFoundError,
} from '../domain/domain.errors';
import type { DomainRuleLoadResult } from '../domain/domains.repository';
import { DomainsRepository } from '../domain/domains.repository';

const buildLoadResult = (id: string): DomainRuleLoadResult => ({
  rule: DomainRule.fromPersistence({
    id,
    domain: 'temu.com',
    name: 'Temu',
    categoryId: null,
    fieldMappings: [{ canonicalField: 'title', selector: '.t', type: 'text' }],
    containerSelector: '.product-card',
    productLimit: 50,
    sampleUrl: 'https://www.temu.com/category-1.html',
    paginationType: 'scroll',
    paginationSelector: 'button.load-more',
    lastScrapedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }),
  categoryName: null,
});

describe('UpdateDomainUseCase', () => {
  let useCase: UpdateDomainUseCase;
  let repository: jest.Mocked<DomainsRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      categoryExists: jest.fn(),
    };
    useCase = new UpdateDomainUseCase(repository);
  });

  it('applies the partial update and persists the rule', async () => {
    repository.findById.mockResolvedValue(buildLoadResult('rule_1'));
    repository.save.mockImplementation(
      async (rule: DomainRule): Promise<DomainRuleLoadResult> => ({
        rule,
        categoryName: null,
      }),
    );

    const result = await useCase.execute({
      id: 'rule_1',
      name: 'Temu (renamed)',
      productLimit: 100,
    });

    expect(result.rule.name).toBe('Temu (renamed)');
    expect(result.rule.productLimit).toBe(100);
    expect(result.rule.domain).toBe('temu.com');
    expect(result.rule.containerSelector).toBe('.product-card');
    expect(result.rule.sampleUrl).toBe('https://www.temu.com/category-1.html');
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('does not call categoryExists when categoryId is undefined', async () => {
    repository.findById.mockResolvedValue(buildLoadResult('rule_1'));
    repository.save.mockImplementation(
      async (rule: DomainRule): Promise<DomainRuleLoadResult> => ({
        rule,
        categoryName: null,
      }),
    );

    await useCase.execute({ id: 'rule_1', name: 'Temu' });

    expect(repository.categoryExists).not.toHaveBeenCalled();
  });

  it('validates the new categoryId when provided', async () => {
    repository.findById.mockResolvedValue(buildLoadResult('rule_1'));
    repository.categoryExists.mockResolvedValue(false);

    await expect(
      useCase.execute({ id: 'rule_1', categoryId: 'cat_missing' }),
    ).rejects.toBeInstanceOf(DomainCategoryNotFoundError);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('accepts a new valid categoryId and persists it', async () => {
    repository.findById.mockResolvedValue(buildLoadResult('rule_1'));
    repository.categoryExists.mockResolvedValue(true);
    repository.save.mockImplementation(
      async (rule: DomainRule): Promise<DomainRuleLoadResult> => ({
        rule,
        categoryName: 'Apparel',
      }),
    );

    const result = await useCase.execute({
      id: 'rule_1',
      categoryId: 'cat_apparel',
    });

    expect(repository.categoryExists).toHaveBeenCalledWith('cat_apparel');
    expect(result.rule.categoryId).toBe('cat_apparel');
    expect(result.categoryName).toBe('Apparel');
  });

  it('clears a field when explicitly passed as null', async () => {
    repository.findById.mockResolvedValue(buildLoadResult('rule_1'));
    repository.save.mockImplementation(
      async (rule: DomainRule): Promise<DomainRuleLoadResult> => ({
        rule,
        categoryName: null,
      }),
    );

    const result = await useCase.execute({
      id: 'rule_1',
      containerSelector: null,
      productLimit: null,
    });

    expect(result.rule.containerSelector).toBeNull();
    expect(result.rule.productLimit).toBeNull();
    expect(result.rule.sampleUrl).toBe('https://www.temu.com/category-1.html');
  });

  it('throws DomainRuleNotFoundError when the row does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ id: 'missing', name: 'X' }),
    ).rejects.toBeInstanceOf(DomainRuleNotFoundError);

    expect(repository.save).not.toHaveBeenCalled();
  });

  it('changes paginationType when provided', async () => {
    repository.findById.mockResolvedValue(buildLoadResult('rule_1'));
    repository.save.mockImplementation(
      async (rule: DomainRule): Promise<DomainRuleLoadResult> => ({
        rule,
        categoryName: null,
      }),
    );

    const result = await useCase.execute({
      id: 'rule_1',
      paginationType: 'page-number',
      paginationSelector: 'a.next',
    });

    expect(result.rule.paginationType).toBe('page-number');
    expect(result.rule.paginationSelector).toBe('a.next');
  });
});
