import { TestBed } from '@angular/core/testing';
import { EtlStreamPanelComponent } from './etl-stream-panel.component';
import type { EtlRunDto } from '@web-scraping/contracts/pipeline';

/**
 * Spec for EtlStreamPanelComponent — Insight Flow variant.
 *
 * Sprint 4: data-testid hooks replace legacy class selectors.
 * The 'should render details' test now drives `streamActive=false`
 * to exercise the polling/listening branch (renders the
 * `.stream-status` placeholder), which is what the assertion
 * actually wants. The previous spec used `streamActive=true`,
 * which routes into the live-stream branch and never renders
 * `.stream-status` — a pre-existing latent bug in the spec.
 */
describe('EtlStreamPanelComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EtlStreamPanelComponent],
    });
  });

  it('should render placeholder when run is null', () => {
    const fixture = TestBed.createComponent(EtlStreamPanelComponent);
    fixture.componentRef.setInput('run', null);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="placeholder-panel"]')).toBeTruthy();
    expect(compiled.querySelector('[data-testid="stream-panel"]')).toBeNull();
  });

  it('should render detail metrics and listening indicator for RUNNING with no active stream', () => {
    const run: EtlRunDto = {
      id: 'run-123',
      source: 'aliexpress',
      status: 'RUNNING',
      startedAt: '2026-07-12T00:00:00.000Z',
      finishedAt: null,
      rowsScraped: 150,
      rowsPersisted: 100,
      durationMs: null,
      errorSummary: null,
    };

    const fixture = TestBed.createComponent(EtlStreamPanelComponent);
    fixture.componentRef.setInput('run', run);
    fixture.componentRef.setInput('streamActive', false);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="placeholder-panel"]')).toBeNull();
    expect(compiled.querySelector('[data-testid="stream-panel"]')).toBeTruthy();
    expect(compiled.querySelector('h4')?.textContent).toContain('Detalle de Ejecución: aliexpress');
    expect(compiled.querySelector('[data-testid="status-badge"]')?.textContent?.trim()).toBe(
      'RUNNING',
    );
    expect(compiled.querySelector('[data-testid="stream-status"]')).toBeTruthy();
    expect(compiled.textContent).toContain('150');
    expect(compiled.textContent).toContain('100');
  });

  it('should render live-stream table when streamActive=true', () => {
    const run: EtlRunDto = {
      id: 'run-456',
      source: 'mercadolibre',
      status: 'RUNNING',
      startedAt: '2026-07-12T00:00:00.000Z',
      finishedAt: null,
      rowsScraped: 0,
      rowsPersisted: 0,
      durationMs: null,
      errorSummary: null,
    };

    const fixture = TestBed.createComponent(EtlStreamPanelComponent);
    fixture.componentRef.setInput('run', run);
    fixture.componentRef.setInput('streamActive', true);
    fixture.componentRef.setInput('products', [
      {
        seq: 1,
        producto: 'Test product',
        precio: '$10',
        fuente: 'mercadolibre',
        estado: 'OK',
      },
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="stream-status"]')).toBeNull();
    expect(compiled.textContent).toContain('Transfiriendo...');
    expect(compiled.textContent).toContain('Test product');
  });

  it('should display error block when errorSummary is present', () => {
    const run: EtlRunDto = {
      id: 'run-123',
      source: 'temu',
      status: 'FAILED',
      startedAt: '2026-07-12T00:00:00.000Z',
      finishedAt: '2026-07-12T00:01:00.000Z',
      rowsScraped: 50,
      rowsPersisted: 0,
      durationMs: 60000,
      errorSummary: 'Fatal connection error occurred',
    };

    const fixture = TestBed.createComponent(EtlStreamPanelComponent);
    fixture.componentRef.setInput('run', run);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="error-box"]')).toBeTruthy();
    expect(compiled.querySelector('[data-testid="error-box"] pre')?.textContent).toContain(
      'Fatal connection error occurred',
    );
    expect(compiled.querySelector('[data-testid="stream-status"]')).toBeNull();
  });
});
