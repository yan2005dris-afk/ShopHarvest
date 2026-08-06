import { TestBed } from '@angular/core/testing';
import { ConfirmModalComponent } from './confirm-modal.component';
import { vi } from 'vitest';

/**
 * Spec for ConfirmModalComponent — Insight Flow variant.
 *
 * Sprint 4: the modal pre-selects every available source on the
 * false→true transition (effect() in the constructor), so the
 * common case (open → click confirm) emits `source: 'all'` without
 * any per-source interaction.
 *
 * `onCancel()` resets the selection to an empty Set, so the
 * "confirm + cancel" flow must be tested as two SEPARATE scenarios:
 * one that asserts confirm emits when sources are pre-selected,
 * one that asserts cancel emits without firing confirm.
 */
describe('ConfirmModalComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ConfirmModalComponent],
    });
  });

  it('should not render anything when isOpen is false', () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="modal-backdrop"]')).toBeNull();
  });

  it('should render details when isOpen is true', () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('title', 'Custom Title');
    fixture.componentRef.setInput('message', 'Custom Message');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="modal-backdrop"]')).toBeTruthy();
    expect(compiled.querySelector('h3')?.textContent).toContain('Custom Title');
    expect(compiled.querySelector('[data-testid="modal-content"] p')?.textContent).toContain(
      'Custom Message',
    );
  });

  it('should pre-select every source on open so confirm emits source=all with one click', () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const confirmSpy = vi.fn();
    fixture.componentInstance.confirm.subscribe(confirmSpy);

    const confirmBtn = fixture.nativeElement.querySelector(
      '[data-testid="btn-confirm"]',
    ) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);

    confirmBtn.click();
    expect(confirmSpy).toHaveBeenCalledWith({ action: 'full', source: 'all' });
  });

  it('should emit cancel when the cancel button is clicked', () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const cancelSpy = vi.fn();
    fixture.componentInstance.cancel.subscribe(cancelSpy);

    const cancelBtn = fixture.nativeElement.querySelector(
      '[data-testid="btn-cancel"]',
    ) as HTMLButtonElement;
    cancelBtn.click();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('should disable the confirm button and not emit when no sources are selected', () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    const confirmSpy = vi.fn();
    fixture.componentInstance.confirm.subscribe(confirmSpy);

    // Imperatively clear the auto-selected set — the effect won't
    // re-run because isOpen didn't flip false→true again.
    fixture.componentInstance.selectedSources.set(new Set());
    fixture.detectChanges();

    const confirmBtn = fixture.nativeElement.querySelector(
      '[data-testid="btn-confirm"]',
    ) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);

    confirmBtn.click();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('should toggle a source via the checkbox', () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    // All 4 sources start selected.
    expect(fixture.componentInstance.selectedSources().size).toBe(4);

    const firstCheckbox = fixture.nativeElement.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    firstCheckbox.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedSources().size).toBe(3);
  });

  it('should seed only the preselected sources and restrict the list to them', () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    fixture.componentRef.setInput('preselectedSources', [
      { code: 'temu', label: 'Temu' },
    ]);
    fixture.componentRef.setInput('pendingSources', [
      { code: 'mercadolibre', label: 'MercadoLibre' },
      { code: 'temu', label: 'Temu' },
    ]);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedSources()).toEqual(new Set(['temu']));
    expect(fixture.componentInstance.availableSources()).toEqual([
      { code: 'temu', label: 'Temu' },
    ]);

    const checkboxes = fixture.nativeElement.querySelectorAll(
      'input[type="checkbox"]',
    ) as NodeListOf<HTMLInputElement>;
    expect(checkboxes.length).toBe(1);

    const confirmSpy = vi.fn();
    fixture.componentInstance.confirm.subscribe(confirmSpy);
    (fixture.nativeElement.querySelector('[data-testid="btn-confirm"]') as HTMLButtonElement).click();
    // Opened scoped by a preselection → local is the lead action.
    expect(confirmSpy).toHaveBeenCalledWith({ action: 'local', source: 'temu' });
  });

  it('should emit source=all when the preselection covers every source', () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    fixture.componentRef.setInput('preselectedSources', [
      { code: 'mercadolibre', label: 'MercadoLibre' },
      { code: 'aliexpress', label: 'AliExpress' },
      { code: 'temu', label: 'Temu' },
      { code: 'shein', label: 'SHEIN' },
    ]);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedSources().size).toBe(4);

    const confirmSpy = vi.fn();
    fixture.componentInstance.confirm.subscribe(confirmSpy);
    (fixture.nativeElement.querySelector('[data-testid="btn-confirm"]') as HTMLButtonElement).click();
    // Opened scoped by a preselection covering every source → local is the
    // lead action, but source=all still resolves across the full set.
    expect(confirmSpy).toHaveBeenCalledWith({ action: 'local', source: 'all' });
  });

  it('should restrict the local list to preselected codes that also have pending items', () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    fixture.componentRef.setInput('preselectedSources', [
      { code: 'temu', label: 'Temu' },
      { code: 'shein', label: 'SHEIN' },
    ]);
    fixture.componentRef.setInput('pendingSources', [
      { code: 'shein', label: 'SHEIN' },
    ]);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    // Switch to local action → effective list is only the intersection.
    fixture.componentInstance.onActionChange('local');
    fixture.detectChanges();

    expect(fixture.componentInstance.action()).toBe('local');
    expect(fixture.componentInstance.availableSources()).toEqual([
      { code: 'shein', label: 'SHEIN' },
    ]);
    expect(fixture.componentInstance.selectedSources()).toEqual(new Set(['shein']));
  });

  it('should default to the local action when opened scoped by a preselected source', () => {
    const fixture = TestBed.createComponent(ConfirmModalComponent);
    fixture.componentRef.setInput('preselectedSources', [{ code: 'shein', label: 'SHEIN' }]);
    fixture.componentRef.setInput('pendingSources', [
      { code: 'shein', label: 'SHEIN' },
      { code: 'temu', label: 'Temu' },
    ]);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();

    // Opened with a card selected → ETL Local is the lead action,
    // scoped to the preselected source with pending items.
    expect(fixture.componentInstance.action()).toBe('local');
    expect(fixture.componentInstance.availableSources()).toEqual([
      { code: 'shein', label: 'SHEIN' },
    ]);
  });
});
