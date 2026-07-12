import { TestBed } from '@angular/core/testing';
import { EtlStreamPanelComponent } from './etl-stream-panel.component';
import type { EtlRunDto } from '@web-scraping/contracts/pipeline';

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
    expect(compiled.querySelector('.placeholder-panel')).toBeTruthy();
    expect(compiled.querySelector('.stream-panel')).toBeNull();
  });

  it('should render details when run is provided', () => {
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
    fixture.componentRef.setInput('streamActive', true);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.placeholder-panel')).toBeNull();
    expect(compiled.querySelector('.stream-panel')).toBeTruthy();
    expect(compiled.querySelector('h4')?.textContent).toContain('Detalle de Ejecución: aliexpress');
    expect(compiled.querySelector('.status-badge')?.textContent?.trim()).toBe('RUNNING');
    expect(compiled.querySelector('.stream-status')).toBeTruthy();
    expect(compiled.textContent).toContain('150');
    expect(compiled.textContent).toContain('100');
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
    expect(compiled.querySelector('.error-box')).toBeTruthy();
    expect(compiled.querySelector('.error-box pre')?.textContent).toContain('Fatal connection error occurred');
    expect(compiled.querySelector('.stream-status')).toBeNull();
  });
});
