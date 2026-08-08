import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../services/api.service';
import type { ScrapeResult } from '@web-scraping/contracts/pipeline';

interface SourceMeta {
  id: string;
  name: string;
  description: string;
  url: string;
  status: 'active' | 'extension' | 'pending';
}

const SOURCE_METADATA: SourceMeta[] = [
  {
    id: 'mercadolibre',
    name: 'MercadoLibre',
    description: 'MercadoLibre Ecuador',
    url: 'mercadolibre.com.ec',
    status: 'active',
  },
  {
    id: 'aliexpress',
    name: 'AliExpress',
    description: 'AliExpress',
    url: 'aliexpress.com',
    status: 'active',
  },
  {
    id: 'temu',
    name: 'Temu',
    description: 'Temu — via Chrome extension export',
    url: 'temu.com',
    status: 'extension',
  },
  {
    id: 'shein',
    name: 'SHEIN',
    description: 'SHEIN — via Chrome extension export',
    url: 'shein.com',
    status: 'extension',
  },
  {
    id: 'api_rates',
    name: 'Exchange Rates API',
    description: 'Exchange rates API',
    url: 'api.exchangerate',
    status: 'pending',
  },
  {
    id: 'csv_dataset',
    name: 'CSV Dataset',
    description: 'CSV dataset import',
    url: '—',
    status: 'pending',
  },
  {
    id: 'encuesta',
    name: 'Encuesta',
    description: 'Encuesta de consumo',
    url: '—',
    status: 'pending',
  },
];

@Component({
  selector: 'app-sources',
  standalone: true,
  imports: [
    MatCardModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './sources.component.html',
  styleUrl: './sources.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourcesComponent implements OnInit {
  private readonly api = inject(ApiService);

  protected sources = signal<string[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected scraping = signal<Record<string, boolean>>({});
  protected results = signal<Record<string, ScrapeResult>>({});

  protected readonly meta = SOURCE_METADATA;

  ngOnInit(): void {
    this.loadSources();
  }

  loadSources(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getSources().subscribe({
      next: (sources) => {
        this.sources.set(sources);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set('Error al cargar fuentes. Verificá que el backend esté funcionando.');
        console.error('Failed to load sources', err);
      },
    });
  }

  scrape(source: string): void {
    this.scraping.update((s) => ({ ...s, [source]: true }));
    this.api.scrapeSource(source, `scraping/${source}`).subscribe({
      next: (result) => {
        this.results.update((r) => ({ ...r, [source]: result }));
        this.scraping.update((s) => ({ ...s, [source]: false }));
      },
      error: (err) => {
        console.error(`Failed to scrape ${source}`, err);
        this.scraping.update((s) => ({ ...s, [source]: false }));
      },
    });
  }

  /**
   * Material Symbols icon name for the given status. The template
   * renders <span class="material-symbols-outlined">{{ icon }}</span>
   * — keeping the icon name as a string lets us add future states
   * (e.g. 'error', 'paused') without touching the template.
   */
  statusIcon(status: SourceMeta['status']): string {
    switch (status) {
      case 'active':
        return 'check_circle';
      case 'extension':
        return 'extension';
      case 'pending':
        return 'schedule';
    }
  }

  statusLabel(status: SourceMeta['status']): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'extension':
        return 'Needs extension';
      case 'pending':
        return 'Pending';
    }
  }

  protected metaFor(source: string): SourceMeta | undefined {
    return SOURCE_METADATA.find((m) => m.id === source);
  }

  trackBySourceId(_index: number, s: string): string {
    return s;
  }
}
