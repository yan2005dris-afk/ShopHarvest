import { Injectable, computed, signal } from '@angular/core';
import type { Categoria, Fuente } from './dashboard.types';

/**
 * Single source of truth for the dashboard's cross-page filter state.
 *
 * Every filter input is exposed as a `WritableSignal` so pages can
 * bind to it directly via `[(ngModel)]` style or via `model()`
 * inputs. A `computed()` aggregation (`filtrosActivos`) bundles the
 * current selection into one read-only snapshot that downstream
 * services can subscribe to via `effect()`.
 *
 * Scope:
 *   - This service is `providedIn: 'root'`, so the filter state
 *     survives navigation between `resumen`, `analisis`, and
 *     `encuesta` without re-mounting.
 *   - Pages that want page-local filters can wrap the service in a
 *     route-level provider override; the dashboard does NOT do that
 *     yet (the prompt marks page-local filter scope as optional).
 *
 * Defaults:
 *   - `fuenteSeleccionada` starts with the five known sources so the
 *     backend receives a complete filter immediately, avoiding the
 *     "first load shows nothing" footgun.
 *   - `categoriaSeleccionada` starts empty — the dashboard renders
 *     all categories until the user actively narrows them down.
 *   - `rangoPrecio` spans [0, 1000] USD which covers the entire DW
 *     catalog (max price seen in the seed data is well below 500).
 */
@Injectable({ providedIn: 'root' })
export class KpiFiltersService {
  /** Available fuentes — populated from response payloads at runtime. */
  readonly fuentes = signal<Fuente[]>([]);

  /** Available categorias — populated from response payloads at runtime. */
  readonly categorias = signal<Categoria[]>([]);

  /** Currently selected fuente ids (multi-select). */
  readonly fuenteSeleccionada = signal<string[]>([
    'mercadolibre',
    'aliexpress',
    'temu',
    'shein',
    'archivos',
  ]);

  /** Currently selected categoria ids (multi-select, empty = all). */
  readonly categoriaSeleccionada = signal<string[]>([]);

  /** Active price range as a [min, max] tuple in USD. */
  readonly rangoPrecio = signal<[number, number]>([0, 1000]);

  /** Only show products that have a non-null availability flag. */
  readonly soloConDisponibilidad = signal(false);

  /** Only show products that have a non-null rating. */
  readonly soloConCalificacion = signal(false);

  /**
   * Read-only snapshot of every filter. Consumers can derive
   * reactive computations off this without re-listing every signal.
   */
  readonly filtrosActivos = computed(() => ({
    fuentes: this.fuenteSeleccionada(),
    categorias: this.categoriaSeleccionada(),
    rangoPrecio: this.rangoPrecio(),
    soloConDisponibilidad: this.soloConDisponibilidad(),
    soloConCalificacion: this.soloConCalificacion(),
  }));

  /**
   * Reset every filter back to its default. Safe to call from any
   * page; useful for the "Limpiar filtros" button the prompt
   * mentions.
   */
  reset(): void {
    this.fuenteSeleccionada.set([
      'mercadolibre',
      'aliexpress',
      'temu',
      'shein',
      'archivos',
    ]);
    this.categoriaSeleccionada.set([]);
    this.rangoPrecio.set([0, 1000]);
    this.soloConDisponibilidad.set(false);
    this.soloConCalificacion.set(false);
  }

  /**
   * Toggle a single fuente in/out of the active selection.
   * Convenience helper to keep multi-select UI terse.
   */
  toggleFuente(value: string): void {
    const current = this.fuenteSeleccionada();
    this.fuenteSeleccionada.set(
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    );
  }

  /** Same as `toggleFuente` but for categorias. */
  toggleCategoria(value: string): void {
    const current = this.categoriaSeleccionada();
    this.categoriaSeleccionada.set(
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value],
    );
  }
}