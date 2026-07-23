import { TestBed } from '@angular/core/testing';
import { EtlManagementPage } from './etl-management.page';
import { EtlManagementStore } from './etl-management.store';
import { ConfirmModalComponent } from './components/confirm-modal.component';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';

/**
 * Spec for EtlManagementPage — Insight Flow variant.
 *
 * Sprint 4:
 *   - Trigger button now has `data-testid="btn-trigger"` (Tailwind
 *     utility classes removed the legacy `.btn-trigger` BEM hook).
 *   - The trigger button is `[disabled]` when no pending sources are
 *     selected, so the spec seeds `pendingSummary` with at least one
 *     source and pre-selects it via component instance.
 */
describe('EtlManagementPage', () => {
  let storeMock: any;

  beforeEach(() => {
    storeMock = {
      runs: vi.fn().mockReturnValue([]),
      meta: vi.fn().mockReturnValue(null),
      loading: vi.fn().mockReturnValue(false),
      error: signalMock(null),
      clearError: vi.fn(),
      selectedRun: vi.fn().mockReturnValue(null),
      streamActive: vi.fn().mockReturnValue(false),
      pendingSummary: vi.fn().mockReturnValue({
        total: 1,
        sources: {
          mercadolibre: { name: 'MercadoLibre', pending: 5, failed: 0 },
        },
      }),
      loadRuns: vi.fn(),
      triggerRun: vi.fn(),
      selectRun: vi.fn(),
      setPage: vi.fn(),
      setFilters: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [EtlManagementPage],
      providers: [{ provide: EtlManagementStore, useValue: storeMock }],
    });
  });

  function signalMock(initialValue: any) {
    const sig = vi.fn().mockReturnValue(initialValue) as any;
    sig.set = vi.fn();
    return sig;
  }

  it('should initialize and load runs', () => {
    const fixture = TestBed.createComponent(EtlManagementPage);
    fixture.detectChanges();

    expect(storeMock.loadRuns).toHaveBeenCalled();
  });

  it('should trigger ETL run when confirmation is confirmed', () => {
    const fixture = TestBed.createComponent(EtlManagementPage);
    fixture.detectChanges();

    // Pre-select the pending source so the trigger button is enabled.
    fixture.componentInstance.selectedPendingSources.set(new Set(['mercadolibre']));
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const triggerBtn = compiled.querySelector('[data-testid="btn-trigger"]') as HTMLButtonElement;
    expect(triggerBtn).toBeTruthy();
    expect(triggerBtn.disabled).toBe(false);

    triggerBtn.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isConfirmOpen()).toBe(true);

    // Confirm execution via modal component output binding.
    const modalDebugEl = fixture.debugElement.query(By.directive(ConfirmModalComponent));
    expect(modalDebugEl).toBeTruthy();
    modalDebugEl.triggerEventHandler('confirm', { action: 'full', source: 'all' });
    fixture.detectChanges();

    expect(fixture.componentInstance.isConfirmOpen()).toBe(false);
    expect(storeMock.triggerRun).toHaveBeenCalledWith({
      action: 'full',
      source: 'all',
    });
  });

  it('should keep the trigger button disabled when no sources are selected', () => {
    const fixture = TestBed.createComponent(EtlManagementPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const triggerBtn = compiled.querySelector('[data-testid="btn-trigger"]') as HTMLButtonElement;
    expect(triggerBtn).toBeTruthy();
    expect(triggerBtn.disabled).toBe(true);
  });
});
