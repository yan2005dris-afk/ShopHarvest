import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KpiCardComponent } from './kpi-card.component';

/**
 * Spec for the reusable KPI summary card — Insight Flow variant.
 *
 * Asserts:
 *   - `label`, `value`, `delta` and `icon` render into the DOM.
 *   - The optional `delta` and `icon` are omitted from the DOM when
 *     empty (no `[data-testid="kpi-delta"]` element).
 *   - `loading: true` puts the card into the skeleton state — both
 *     `aria-busy="true"` is set and the value/label text are not
 *     rendered.
 *   - `accent` input maps to the correct CSS var on the accent bar.
 *
 * Sprint 3: tests now look up by `data-testid` instead of BEM class
 * names because most styling moved to Tailwind utility classes; the
 * DOM no longer exposes `.kpi-label` / `.kpi-value` / `.kpi-delta`
 * as CSS hooks. The component root still keeps `.kpi-card` for the
 * `aria-busy` assertion.
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
      trend: 'up' | 'down';
      icon: string;
      accent: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
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
    if (inputs.trend !== undefined)
      fixture.componentRef.setInput('trend', inputs.trend);
    if (inputs.icon !== undefined)
      fixture.componentRef.setInput('icon', inputs.icon);
    if (inputs.accent !== undefined)
      fixture.componentRef.setInput('accent', inputs.accent);
    if (inputs.loading !== undefined)
      fixture.componentRef.setInput('loading', inputs.loading);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders label, value and delta when supplied', () => {
    const host = render({ label: 'Total', value: 42, delta: '+10%', icon: 'inventory_2' });
    expect(host.querySelector('[data-testid="kpi-label"]')?.textContent).toContain(
      'Total',
    );
    expect(host.querySelector('[data-testid="kpi-value"]')?.textContent).toContain(
      '42',
    );
    expect(host.querySelector('[data-testid="kpi-delta"]')?.textContent).toContain(
      '+10%',
    );
    // Icon is rendered as a Material Symbols span.
    expect(
      host
        .querySelector('header .material-symbols-outlined')
        ?.textContent?.trim(),
    ).toBe('inventory_2');
  });

  it('omits the delta row when delta is empty', () => {
    const host = render({ label: 'Sin delta', value: '0' });
    expect(host.querySelector('[data-testid="kpi-delta"]')).toBeNull();
  });

  it('omits the icon span when icon is empty', () => {
    const host = render({ label: 'Sin icono', value: '0' });
    expect(host.querySelector('header .material-symbols-outlined')).toBeNull();
  });

  it('switches to the skeleton state when loading=true', () => {
    const host = render({ label: 'Cargando', value: 0, loading: true });
    // Skeleton state hides label/value/delta text — only shimmer bars render.
    expect(host.querySelector('[data-testid="kpi-value"]')).toBeNull();
    expect(host.querySelector('[data-testid="kpi-label"]')).toBeNull();
    expect(host.querySelector('[data-testid="kpi-delta"]')).toBeNull();
    // Root element still exists with aria-busy=true.
    expect(host.querySelector('.kpi-card')?.getAttribute('aria-busy')).toBe(
      'true',
    );
  });

  it('renders the trend glyph for trend=up', () => {
    const host = render({
      label: 'Total',
      value: 42,
      delta: '+10%',
      trend: 'up',
    });
    const delta = host.querySelector('[data-testid="kpi-delta"]');
    expect(delta?.textContent).toContain('trending_up');
    expect(delta?.textContent).toContain('+10%');
  });

  it('renders the trend glyph for trend=down', () => {
    const host = render({
      label: 'Total',
      value: 42,
      delta: '-5%',
      trend: 'down',
    });
    const delta = host.querySelector('[data-testid="kpi-delta"]');
    expect(delta?.textContent).toContain('trending_down');
  });

  it('maps accent=success to the success CSS var on the accent bar', () => {
    const host = render({
      label: 'Total',
      value: 42,
      accent: 'success',
    });
    const card = host.querySelector('.kpi-card') as HTMLElement;
    expect(card.style.getPropertyValue('--accent')).toBe('var(--color-success)');
  });

  it('defaults accent to primary', () => {
    const host = render({ label: 'Total', value: 42 });
    const card = host.querySelector('.kpi-card') as HTMLElement;
    expect(card.style.getPropertyValue('--accent')).toBe('var(--color-primary)');
  });
});