import { DeleteDomainUseCase } from './delete-domain.use-case';
import { DomainRule } from '../domain/domain.entity';
import { DomainRuleNotFoundError } from '../domain/domain.errors';
import type { DomainRuleLoadResult } from '../domain/domains.repository';
import { DomainsRepository } from '../domain/domains.repository';

describe('DeleteDomainUseCase', () => {
  let useCase: DeleteDomainUseCase;
  let repository: jest.Mocked<DomainsRepository>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      categoryExists: jest.fn(),
    };
    useCase = new DeleteDomainUseCase(repository);
  });

  it('deletes an existing rule', async () => {
    const load: DomainRuleLoadResult = {
      rule: DomainRule.create({
        id: 'rule_1',
        domain: 'temu.com',
        name: 'Temu',
      }),
      categoryName: null,
    };
    repository.findById.mockResolvedValue(load);

    await useCase.execute('rule_1');

    expect(repository.findById).toHaveBeenCalledWith('rule_1');
    expect(repository.delete).toHaveBeenCalledWith('rule_1');
  });

  it('throws DomainRuleNotFoundError when the row is missing', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(useCase.execute('missing')).rejects.toBeInstanceOf(
      DomainRuleNotFoundError,
    );
    expect(repository.delete).not.toHaveBeenCalled();
  });
});
