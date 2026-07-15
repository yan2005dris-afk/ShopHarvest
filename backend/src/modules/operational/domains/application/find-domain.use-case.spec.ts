import { FindDomainUseCase } from './find-domain.use-case';
import { DomainRule } from '../domain/domain.entity';
import { DomainRuleNotFoundError } from '../domain/domain.errors';
import type { DomainRuleLoadResult } from '../domain/domains.repository';
import { DomainsRepository } from '../domain/domains.repository';

describe('FindDomainUseCase', () => {
  let useCase: FindDomainUseCase;
  let repository: jest.Mocked<DomainsRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      categoryExists: jest.fn(),
    };
    useCase = new FindDomainUseCase(repository);
  });

  it('returns the enriched load result when the rule exists', async () => {
    const load: DomainRuleLoadResult = {
      rule: DomainRule.create({
        id: 'rule_1',
        domain: 'temu.com',
        name: 'Temu',
      }),
      categoryName: 'Electronics',
    };
    repository.findById.mockResolvedValue(load);

    const result = await useCase.execute('rule_1');

    expect(repository.findById).toHaveBeenCalledWith('rule_1');
    expect(result).toBe(load);
    expect(result.categoryName).toBe('Electronics');
  });

  it('throws DomainRuleNotFoundError when missing', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      DomainRuleNotFoundError,
    );
  });
});
