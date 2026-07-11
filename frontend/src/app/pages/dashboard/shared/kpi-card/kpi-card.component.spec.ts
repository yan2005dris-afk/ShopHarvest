import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KpiCardComponent } from './kpi-card.component';

/**
 * Spec for the reusable KPI summary card.
 *
 * Asserts:
 *   - `label`, `value`, `delta` and `icon` render into the DOM.
 *   - The optional `delta` and `icon` are omitted from the DOM when
 *     empty (no `<div class="kpi-delta">` element).
 *   - `loading: true` puts the card into the skeleton state — both
 *     `aria-busy="true"` is set and the value/label text are not
 *     rendered.
 */
describe('KpiCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KpiCardComponent],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function render(
    inputs: Partial<{
      label: string;
      value: string | number;
      delta: string;
      icon: string;
      loading: boolean;
    }>,
  ): HTMLElement {
    const fixture = TestBed.createComponent(KpiCardComponent);
    if (inputs.label !== undefined)
      fixture.componentRef.setInput('label', inputs.label);
    if (inputs.value !== undefined)
      fixture.componentRef.setInput('value', inputs.value);
    if (inputs.delta !== undefined)
      fixture.componentRef.setInput('delta', inputs.delta);
    if (inputs.icon !== undefined)
      fixture.componentRef.setInput('icon', inputs.icon);
    if (inputs.loading !== undefined)
      fixture.componentRef.setInput('loading', inputs.loading);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders label, value and delta when supplied', () => {
    const host = render({ label: 'Total', value: 42, delta: '+10%', icon: '📦' });
    expect(host.querySelector('.kpi-label')?.textContent).toContain('Total');
    expect(host.querySelector('.kpi-value')?.textContent).toContain('42');
    expect(host.querySelector('.kpi-delta')?.textContent).toContain('+10%');
    expect(host.querySelector('.kpi-icon')?.textContent).toContain('📦');
  });

  it('omits the delta and icon rows when they are empty', () => {
    const host = render({ label: 'Sin delta', value: '0' });
    expect(host.querySelector('.kpi-delta')).toBeNull();
    expect(host.querySelector('.kpi-icon')).toBeNull();
  });

  it('switches to the skeleton state when loading=true', () => {
    const host = render({ label: 'Cargando', value: 0, loading: true });
    expect(host.querySelector('.kpi-value')?.textContent?.trim()).toBe('');
    expect(host.querySelector('.kpi-label')?.textContent?.trim()).toBe('');
    expect(host.querySelector('.kpi-card')?.getAttribute('aria-busy')).toBe('true');
  });
});