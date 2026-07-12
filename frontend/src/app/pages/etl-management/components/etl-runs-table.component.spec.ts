import { TestBed } from '@angular/core/testing';
import { EtlRunsTableComponent } from './etl-runs-table.component';
import type { EtlRunDto } from '@web-scraping/contracts/pipeline';
import { vi } from 'vitest';

describe('EtlRunsTableComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EtlRunsTableComponent],
    });
  });

  it('should render list of runs', () => {
    const runs: EtlRunDto[] = [
      {
        id: '1',
        source: 'mercadolibre',
        status: 'SUCCESS',
        startedAt: '2026-07-12T00:00:00.000Z',
        finishedAt: '2026-07-12T00:02:00.000Z',
        rowsScraped: 100,
        rowsPersisted: 90,
        durationMs: 120000,
        errorSummary: null,
      },
      {
        id: '2',
        source: 'aliexpress',
        status: 'FAILED',
        startedAt: '2026-07-12T01:00:00.000Z',
        finishedAt: '2026-07-12T01:01:00.000Z',
        rowsScraped: 10,
        rowsPersisted: 0,
        durationMs: 60000,
        errorSummary: 'Error',
      },
    ];

    const fixture = TestBed.createComponent(EtlRunsTableComponent);
    fixture.componentRef.setInput('runs', runs);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const rows = compiled.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);

    expect(rows[0].textContent).toContain('mercadolibre');
    expect(rows[0].textContent).toContain('SUCCESS');
    expect(rows[1].textContent).toContain('aliexpress');
    expect(rows[1].textContent).toContain('FAILED');
  });

  it('should emit filterChange and rowSelect events', () => {
    const runs: EtlRunDto[] = [
      {
        id: '1',
        source: 'mercadolibre',
        status: 'SUCCESS',
        startedAt: '2026-07-12T00:00:00.000Z',
        finishedAt: '2026-07-12T00:02:00.000Z',
        rowsScraped: 100,
        rowsPersisted: 90,
        durationMs: 120000,
        errorSummary: null,
      },
    ];

    const fixture = TestBed.createComponent(EtlRunsTableComponent);
    fixture.componentRef.setInput('runs', runs);
    fixture.detectChanges();

    const filterSpy = vi.fn();
    const selectSpy = vi.fn();

    fixture.componentInstance.filterChange.subscribe(filterSpy);
    fixture.componentInstance.rowSelect.subscribe(selectSpy);

    // Row selection test
    const row = fixture.nativeElement.querySelector('tbody tr');
    row.click();
    expect(selectSpy).toHaveBeenCalledWith(runs[0]);

    // Filter test
    fixture.componentInstance.statusVal = 'SUCCESS';
    fixture.componentInstance.sourceVal = 'mercadolibre';
    fixture.componentInstance.onApply();
    expect(filterSpy).toHaveBeenCalledWith({ status: 'SUCCESS', source: 'mercadolibre' });

    // Clear filter test
    fixture.componentInstance.onClear();
    expect(filterSpy).toHaveBeenLastCalledWith({});
  });
});
