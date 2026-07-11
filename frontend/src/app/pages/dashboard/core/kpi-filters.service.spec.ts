import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KpiFiltersService } from './kpi-filters.service';

/**
 * Spec for the dashboard-wide filter signal store.
 *
 * The dashboard relies on `KpiFiltersService` being a single source
 * of truth for cross-page filter state. This spec covers:
 *   - Default values on first instantiation
 *   - `reset()` returning every signal to its default
 *   - `toggleFuente()` / `toggleCategoria()` adding and removing
 *     entries from the multi-select signals
 *   - `filtrosActivos` `computed()` re-aggregating whenever any
 *     underlying signal changes
 */
describe('KpiFiltersService', () => {
  let service: KpiFiltersService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(KpiFiltersService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('exposes the documented defaults', () => {
    expect(service.fuenteSeleccionada()).toEqual([
      'mercadolibre',
      'aliexpress',
      'temu',
      'shein',
      'archivos',
    ]);
    expect(service.categoriaSeleccionada()).toEqual([]);
    expect(service.rangoPrecio()).toEqual([0, 1000]);
    expect(service.soloConDisponibilidad()).toBe(false);
    expect(service.soloConCalificacion()).toBe(false);
  });

  it('reset() restores every signal to its default', () => {
    service.fuenteSeleccionada.set(['aliexpress']);
    service.categoriaSeleccionada.set(['electronica']);
    service.rangoPrecio.set([10, 200]);
    service.soloConDisponibilidad.set(true);
    service.soloConCalificacion.set(true);

    service.reset();

    expect(service.fuenteSeleccionada()).toEqual([
      'mercadolibre',
      'aliexpress',
      'temu',
      'shein',
      'archivos',
    ]);
    expect(service.categoriaSeleccionada()).toEqual([]);
    expect(service.rangoPrecio()).toEqual([0, 1000]);
    expect(service.soloConDisponibilidad()).toBe(false);
    expect(service.soloConCalificacion()).toBe(false);
  });

  it('toggleFuente adds and removes a fuente id', () => {
    service.fuenteSeleccionada.set(['mercadolibre']);
    service.toggleFuente('aliexpress');
    expect(service.fuenteSeleccionada()).toContain('aliexpress');

    service.toggleFuente('mercadolibre');
    expect(service.fuenteSeleccionada()).not.toContain('mercadolibre');
    expect(service.fuenteSeleccionada()).toContain('aliexpress');
  });

  it('toggleCategoria adds and removes a categoria id', () => {
    service.categoriaSeleccionada.set([]);
    service.toggleCategoria('electronica');
    expect(service.categoriaSeleccionada()).toEqual(['electronica']);

    service.toggleCategoria('electronica');
    expect(service.categoriaSeleccionada()).toEqual([]);
  });

  it('filtrosActivos re-aggregates whenever any signal changes', () => {
    expect(service.filtrosActivos().fuentes).toEqual([
      'mercadolibre',
      'aliexpress',
      'temu',
      'shein',
      'archivos',
    ]);

    service.fuenteSeleccionada.set(['temu']);
    expect(service.filtrosActivos().fuentes).toEqual(['temu']);

    service.rangoPrecio.set([5, 50]);
    expect(service.filtrosActivos().rangoPrecio).toEqual([5, 50]);

    service.soloConCalificacion.set(true);
    expect(service.filtrosActivos().soloConCalificacion).toBe(true);
  });
});