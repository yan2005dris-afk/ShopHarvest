import { ListDomainsUseCase } from './list-domains.use-case';
import { DomainRule } from '../domain/domain.entity';
import type { DomainRuleLoadResult } from '../domain/domains.repository';
import { DomainsRepository } from '../domain/domains.repository';

const buildLoadResult = (id: string, domain: string): DomainRuleLoadResult => ({
  rule: DomainRule.create({
    id,
    domain,
    name: `Name ${id}`,
  }),
  categoryName: null,
});

describe('ListDomainsUseCase', () => {
  let useCase: ListDomainsUseCase;
  let repository: jest.Mocked<DomainsRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      categoryExists: jest.fn(),
    };
    useCase = new ListDomainsUseCase(repository);
  });

  it('passes no host filter when none is provided', async () => {
    const rows = [buildLoadResult('rule_1', 'temu.com')];
    repository.findAll.mockResolvedValue(rows);

    const result = await useCase.execute();

    expect(repository.findAll).toHaveBeenCalledWith(undefined);
    expect(result).toBe(rows);
  });

  it('forwards the host filter to the repository', async () => {
    repository.findAll.mockResolvedValue([]);
    await useCase.execute('temu.com');
    expect(repository.findAll).toHaveBeenCalledWith('temu.com');
  });
});
