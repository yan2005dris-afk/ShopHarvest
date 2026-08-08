import { Component, input, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import type { EtlRunDto } from '@web-scraping/contracts/pipeline';

@Component({
  selector: 'app-etl-load-preview',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    @if (run(); as r) {
      <div
        class="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low text-on-surface"
      >
        <div
          class="flex items-center justify-between border-b border-outline-variant bg-surface-container px-4 py-3"
        >
          <div class="flex items-center gap-2">
            @if (r.status === 'RUNNING') {
              <span class="size-2 animate-pulse rounded-full bg-primary" aria-hidden="true"></span>
            } @else if (r.status === 'SUCCESS') {
              <span class="font-bold text-success" aria-hidden="true">✓</span>
            } @else if (r.status === 'FAILED') {
              <span class="font-bold text-danger" aria-hidden="true">✗</span>
            }
            <span class="text-body-md font-semibold text-on-surface"
              >Carga de datos · {{ r.source }}</span
            >
          </div>
          <span
            class="rounded-xs px-2 py-0.5 text-[11px] font-bold tracking-wider uppercase"
            [class.bg-primary-fixed]="r.status === 'RUNNING'"
            [class.text-primary-container]="r.status === 'RUNNING'"
            [class.bg-success-dim]="r.status === 'SUCCESS'"
            [class.text-success]="r.status === 'SUCCESS'"
            [class.bg-danger-dim]="r.status === 'FAILED'"
            [class.text-danger]="r.status === 'FAILED'"
            [attr.data-status]="r.status"
          >
            {{ r.status }}
          </span>
        </div>

        <div class="p-4">
          @if (r.status === 'RUNNING') {
            <div class="mb-3 flex items-center gap-2 text-body-md font-medium text-primary">
              <span
                class="inline-block size-3.5 rounded-full border-2 border-outline-variant border-t-primary"
                style="animation: spin 0.8s linear infinite"
              ></span>
              <span>Procesando...</span>
            </div>
          }

          <div class="mb-3 grid grid-cols-3 gap-3">
            <div
              class="flex flex-col items-center gap-1 rounded-md border border-outline-variant bg-primary-fixed/20 p-3"
            >
              <span class="text-xl font-extrabold text-primary">{{ r.rowsScraped | number }}</span>
              <span
                class="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
                >Extraídas</span
              >
            </div>
            <div
              class="flex flex-col items-center gap-1 rounded-md border border-outline-variant bg-success-dim p-3"
            >
              <span class="text-xl font-extrabold text-success">{{
                r.rowsPersisted | number
              }}</span>
              <span
                class="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
                >Cargadas</span
              >
            </div>
            <div
              class="flex flex-col items-center gap-1 rounded-md border border-outline-variant bg-danger-dim p-3"
            >
              <span class="text-xl font-extrabold text-danger">{{ failedCount() | number }}</span>
              <span
                class="text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase"
                >Fallidas</span
              >
            </div>
          </div>

          @if (r.status === 'SUCCESS') {
            <p class="m-0 text-body-md font-medium text-success">
              ✓ {{ r.rowsPersisted | number }} filas cargadas al data warehouse
            </p>
          }

          @if (r.errorSummary && r.status === 'FAILED') {
            <div
              class="rounded-md border border-danger/20 bg-danger-dim p-2.5 text-body-md text-danger"
            >
              <strong>Error:</strong> {{ r.errorSummary }}
            </div>
          }
        </div>
      </div>
    } @else {
      <div
        class="rounded-xl border border-dashed border-outline-variant bg-surface-container-low p-5 text-center text-body-md text-on-surface-variant"
      >
        <span>Seleccioná una ejecución para ver el detalle de carga</span>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `,
  ],
})
export class EtlLoadPreviewComponent {
  run = input<EtlRunDto | null>(null);

  failedCount = computed(() => {
    const r = this.run();
    if (!r) return 0;
    return Math.max(0, r.rowsScraped - r.rowsPersisted);
  });
}
