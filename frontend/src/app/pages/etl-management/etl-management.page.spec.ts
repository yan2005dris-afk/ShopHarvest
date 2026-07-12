import { TestBed } from '@angular/core/testing';
import { EtlManagementPage } from './etl-management.page';
import { EtlManagementStore } from './etl-management.store';
import { vi } from 'vitest';

describe('EtlManagementPage', () => {
  let storeMock: any;

  beforeEach(() => {
    storeMock = {
      runs: vi.fn().mockReturnValue([]),
      meta: vi.fn().mockReturnValue(null),
      loading: vi.fn().mockReturnValue(false),
      error: signalMock(null),
      selectedRun: vi.fn().mockReturnValue(null),
      streamActive: vi.fn().mockReturnValue(false),
      loadRuns: vi.fn(),
      triggerRun: vi.fn(),
      selectRun: vi.fn(),
      setPage: vi.fn(),
      setFilters: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [EtlManagementPage],
      providers: [
        { provide: EtlManagementStore, useValue: storeMock },
      ],
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

  it('should open confirm modal on trigger button click and trigger run on confirm', () => {
    const fixture = TestBed.createComponent(EtlManagementPage);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const triggerBtn = compiled.querySelector('.btn-trigger') as HTMLButtonElement;
    expect(triggerBtn).toBeTruthy();

    triggerBtn.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isConfirmOpen()).toBe(true);

    // Confirm execution
    fixture.componentInstance.onConfirmTrigger();
    fixture.detectChanges();

    expect(fixture.componentInstance.isConfirmOpen()).toBe(false);
    expect(storeMock.triggerRun).toHaveBeenCalled();
  });
});
