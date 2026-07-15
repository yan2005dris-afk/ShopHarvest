import { Component, input, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import type { EtlRunDto } from '@web-scraping/contracts/pipeline';

export interface StreamedProduct {
  seq: number;
  producto: string;
  precio: string;
  fuente: string;
  estado: string;
}

/**
 * EtlStreamPanelComponent — detail view for a selected ETL run.
 *
 * Renders one of three states:
 *   1. Placeholder (no run selected).
 *   2. Live stream (RUNNING + streamActive=true): spinner + product
 *      table updating in real time.
 *   3. Detail (terminal status OR RUNNING + streamActive=false):
 *      metric grid + run metadata + optional error block.
 *
 * Sprint 4: tokens migrated to Insight Flow (--color-* + Material 3
 * surface tones). Status badges use semantic tokens (primary for
 * RUNNING, success for SUCCESS, danger for FAILED).
 */
@Component({
  selector: 'app-etl-stream-panel',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  template: `
    @if (run(); as selectedRun) {
      <section
        class="mb-5 overflow-hidden rounded-xl border border-outline-variant bg-surface text-on-surface"
        [class.collapsed]="collapsed()"
        data-testid="stream-panel"
      >
        <header
          class="flex cursor-pointer items-center justify-between border-b border-outline-variant bg-surface-container-low px-4 py-3.5 select-none"
          (click)="toggleCollapse()"
        >
          <div class="flex items-center gap-3">
            <span
              class="h-2.5 w-2.5 rounded-full bg-on-surface-variant"
              [class.bg-primary]="selectedRun.status === 'RUNNING'"
              [class.pulse-active]="selectedRun.status === 'RUNNING'"
              aria-hidden="true"
            ></span>
            <h4 class="m-0 text-base font-semibold">
              Detalle de Ejecución: {{ selectedRun.source }}
            </h4>
            <span
              class="rounded-xs px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase"
              [class.bg-primary-fixed]="selectedRun.status === 'RUNNING'"
              [class.text-primary-container]="selectedRun.status === 'RUNNING'"
              [class.bg-success-dim]="selectedRun.status === 'SUCCESS'"
              [class.text-success]="selectedRun.status === 'SUCCESS'"
              [class.bg-danger-dim]="selectedRun.status === 'FAILED'"
              [class.text-danger]="selectedRun.status === 'FAILED'"
              data-testid="status-badge"
              [attr.data-status]="selectedRun.status"
            >
              {{ selectedRun.status }}
            </span>
          </div>
          <div class="flex items-center gap-3">
            @if (selectedRun.status === 'RUNNING' && streamActive()) {
              <span class="text-body-md font-semibold text-primary">
                {{ streamedProducts().length }} transferidos
              </span>
            }
            <button
              type="button"
              class="rounded-md px-2 py-1 text-body-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <span class="material-symbols-outlined align-middle" style="font-size: 16px">
                {{ collapsed() ? 'expand_more' : 'expand_less' }}
              </span>
            </button>
          </div>
        </header>

        @if (!collapsed()) {
          <div class="space-y-4 p-4">
            @if (selectedRun.status === 'RUNNING' && streamActive()) {
              <div class="mb-3 flex items-center gap-2.5 text-body-md font-semibold text-primary">
                <span
                  class="inline-block h-3.5 w-3.5 rounded-full border-2 border-outline-variant border-t-primary"
                  style="animation: spin 0.8s linear infinite"
                ></span>
                <span>Transfiriendo...</span>
              </div>

              <div
                class="max-h-96 overflow-y-auto rounded-md border border-outline-variant"
              >
                <table class="w-full border-collapse text-body-md">
                  <thead>
                    <tr class="bg-surface-container-low">
                      <th class="px-3 py-2.5 text-left font-semibold text-on-surface-variant">#</th>
                      <th class="px-3 py-2.5 text-left font-semibold text-on-surface-variant">Producto</th>
                      <th class="px-3 py-2.5 text-left font-semibold text-on-surface-variant">Precio</th>
                      <th class="px-3 py-2.5 text-left font-semibold text-on-surface-variant">Fuente</th>
                      <th class="px-3 py-2.5 text-left font-semibold text-on-surface-variant">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (product of streamedProducts(); track product.seq) {
                      <tr class="border-b border-outline-variant transition-colors hover:bg-surface-container-low">
                        <td class="w-12 px-3 py-2 text-on-surface-variant">{{ product.seq }}</td>
                        <td class="max-w-xs overflow-hidden px-3 py-2 text-ellipsis whitespace-nowrap">{{ product.producto }}</td>
                        <td class="w-24 px-3 py-2">{{ product.precio }}</td>
                        <td class="w-24 px-3 py-2">{{ product.fuente }}</td>
                        <td class="w-20 px-3 py-2">
                          <span
                            class="rounded-xs px-1.5 py-0.5 text-[11px] font-bold"
                            [class.bg-success-dim]="product.estado === 'OK'"
                            [class.text-success]="product.estado === 'OK'"
                            [class.bg-warning-dim]="product.estado === 'PENDING'"
                            [class.text-warning]="product.estado === 'PENDING'"
                            [class.bg-danger-dim]="product.estado === 'ERROR'"
                            [class.text-danger]="product.estado === 'ERROR'"
                          >
                            {{ product.estado }}
                          </span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <div class="mb-4 grid grid-cols-3 gap-4">
                <div class="flex flex-col items-center rounded-md border border-outline-variant bg-surface-container-low p-3">
                  <span class="mb-1 text-label-caps text-on-surface-variant">Filas Extraídas</span>
                  <span class="text-xl font-bold">{{ selectedRun.rowsScraped | number }}</span>
                </div>
                <div class="flex flex-col items-center rounded-md border border-outline-variant bg-surface-container-low p-3">
                  <span class="mb-1 text-label-caps text-on-surface-variant">Filas Persistidas</span>
                  <span class="text-xl font-bold">{{ selectedRun.rowsPersisted | number }}</span>
                </div>
                <div class="flex flex-col items-center rounded-md border border-outline-variant bg-surface-container-low p-3">
                  <span class="mb-1 text-label-caps text-on-surface-variant">Duración</span>
                  <span class="text-xl font-bold">
                    {{
                      selectedRun.durationMs
                        ? (selectedRun.durationMs / 1000 | number: '1.1-2') + 's'
                        : 'En progreso...'
                    }}
                  </span>
                </div>
              </div>

              <div class="mb-4 flex flex-col gap-2 text-body-md">
                <div class="flex justify-between border-b border-dashed border-outline-variant pb-1.5">
                  <span class="text-on-surface-variant">ID de Ejecución:</span>
                  <span class="font-medium">{{ selectedRun.id }}</span>
                </div>
                <div class="flex justify-between border-b border-dashed border-outline-variant pb-1.5">
                  <span class="text-on-surface-variant">Inicio:</span>
                  <span class="font-medium">{{ selectedRun.startedAt | date: 'medium' }}</span>
                </div>
                @if (selectedRun.finishedAt) {
                  <div class="flex justify-between border-b border-dashed border-outline-variant pb-1.5">
                    <span class="text-on-surface-variant">Fin:</span>
                    <span class="font-medium">{{ selectedRun.finishedAt | date: 'medium' }}</span>
                  </div>
                }
              </div>

              @if (selectedRun.errorSummary) {
                <div
                  class="mb-4 rounded-md border border-outline-variant bg-danger-dim p-3"
                  data-testid="error-box"
                >
                  <h5 class="m-0 mb-2 text-body-md font-semibold text-danger">
                    Detalle del Error
                  </h5>
                  <pre class="m-0 font-mono text-body-md text-danger whitespace-pre-wrap break-all">{{ selectedRun.errorSummary }}</pre>
                </div>
              }

              @if (selectedRun.status === 'RUNNING' && !streamActive()) {
                <div
                  class="flex items-center justify-center gap-2.5 rounded-md bg-surface-container-low p-2 text-body-md text-on-surface-variant"
                  data-testid="stream-status"
                >
                  <span
                    class="inline-block h-4 w-4 rounded-full border-2 border-outline-variant border-t-primary"
                    style="animation: spin 0.8s linear infinite"
                  ></span>
                  <span>Escuchando eventos en tiempo real...</span>
                </div>
              }
            }
          </div>
        }
      </section>
    } @else {
      <div
        class="mb-5 rounded-xl border border-dashed border-outline-variant bg-surface p-6 text-center text-body-md text-on-surface-variant"
        data-testid="placeholder-panel"
      >
        <p>Seleccione una ejecución de la tabla para ver su progreso en tiempo real.</p>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      /* Pulse + spin animations kept in component CSS — Tailwind has
         no primitive for these keyframes. */
      .pulse-active {
        box-shadow: 0 0 0 0 var(--color-primary);
        animation: pulse 1.6s infinite;
      }

      @keyframes pulse {
        0% {
          transform: scale(0.95);
          box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 50%, transparent);
        }
        70% {
          transform: scale(1);
          box-shadow: 0 0 0 8px color-mix(in srgb, var(--color-primary) 0%, transparent);
        }
        100% {
          transform: scale(0.95);
          box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 0%, transparent);
        }
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .collapsed header {
        border-bottom: none;
      }
    `,
  ],
})
export class EtlStreamPanelComponent {
  run = input<EtlRunDto | null>(null);
  streamActive = input<boolean>(false);
  products = input<StreamedProduct[]>([]);

  collapsed = signal<boolean>(false);

  readonly streamedProducts = computed<StreamedProduct[]>(() => {
    const inputProducts = this.products();
    if (inputProducts.length > 0) {
      return inputProducts;
    }
    return [];
  });

  toggleCollapse(): void {
    this.collapsed.update((c) => !c);
  }
}