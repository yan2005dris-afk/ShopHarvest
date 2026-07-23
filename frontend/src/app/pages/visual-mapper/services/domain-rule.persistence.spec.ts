import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { DomainRulePersistenceService } from './domain-rule.persistence';
import { ApiService, DomainRule } from '../../../services/api.service';
import type { ExtensionFieldMapping } from '../../../services/extension.service';

/**
 * Regression coverage for the extractAll → "Save Domain Rule" 400 bug:
 * fields picked in extractAll mode carry `selector: ''` (there is no
 * real per-field CSS selector, only a canonical-name → extracted-key
 * rename — see MappingSessionService.selectFieldForMapping). The
 * backend's FieldMappingDto requires a non-empty selector
 * (@IsNotEmpty), so sending that empty string straight through used to
 * 400 on every save once container-only became the only mapping
 * methodology.
 */
describe('DomainRulePersistenceService', () => {
  function createService(existingDomains: DomainRule[] = []) {
    const apiMock = {
      createDomain: vi.fn().mockReturnValue(of({})),
      updateDomain: vi.fn().mockReturnValue(of({})),
    };

    TestBed.configureTestingModule({
      providers: [DomainRulePersistenceService, { provide: ApiService, useValue: apiMock }],
    });

    return {
      service: TestBed.inject(DomainRulePersistenceService),
      apiMock,
      existingDomains,
    };
  }

  const extractAllMappings: ExtensionFieldMapping[] = [
    { canonicalField: 'titulo', selector: '', type: 'text', extractedKey: 'title' },
    { canonicalField: 'precio', selector: '', type: 'text', extractedKey: 'precio' },
  ];

  it('patches empty selectors to the extractAll placeholder on create', () => {
    const { service, apiMock } = createService();

    service
      .saveDomainRule(
        {
          hostname: 'temu.com',
          pageTitle: 'Temu',
          fieldMappings: extractAllMappings,
          containerSelector: '.product-card',
        },
        [],
      )
      .subscribe();

    expect(apiMock.createDomain).toHaveBeenCalledTimes(1);
    const payload = apiMock.createDomain.mock.calls[0][0];
    expect(payload.fieldMappings).toEqual([
      { canonicalField: 'titulo', selector: '[extractAll]', type: 'text', attribute: undefined },
      { canonicalField: 'precio', selector: '[extractAll]', type: 'text', attribute: undefined },
    ]);
  });

  it('patches empty selectors to the extractAll placeholder on update', () => {
    const existing: DomainRule = {
      id: 'd1',
      domain: 'temu.com',
      name: 'Temu',
      containerSelector: '.old',
      fieldMappings: [],
    } as unknown as DomainRule;
    const { service, apiMock } = createService([existing]);

    service
      .saveDomainRule(
        {
          hostname: 'temu.com',
          pageTitle: 'Temu',
          fieldMappings: extractAllMappings,
          containerSelector: '.product-card',
        },
        [existing],
      )
      .subscribe();

    expect(apiMock.updateDomain).toHaveBeenCalledTimes(1);
    const payload = apiMock.updateDomain.mock.calls[0][1];
    expect(payload.fieldMappings).toEqual([
      { canonicalField: 'titulo', selector: '[extractAll]', type: 'text', attribute: undefined },
      { canonicalField: 'precio', selector: '[extractAll]', type: 'text', attribute: undefined },
    ]);
  });

  it('leaves a real per-field selector untouched (legacy manually-mapped rule)', () => {
    const { service, apiMock } = createService();

    service
      .saveDomainRule(
        {
          hostname: 'shein.com',
          pageTitle: 'Shein',
          fieldMappings: [{ canonicalField: 'precio', selector: '.price', type: 'text' }],
          containerSelector: '.card',
        },
        [],
      )
      .subscribe();

    const payload = apiMock.createDomain.mock.calls[0][0];
    expect(payload.fieldMappings).toEqual([
      { canonicalField: 'precio', selector: '.price', type: 'text', attribute: undefined },
    ]);
  });
});
