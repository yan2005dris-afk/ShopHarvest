import type { Routes } from '@angular/router';
import { DashboardShellComponent } from './layout/dashboard-shell.component';

/**
 * Dashboard lazy routes.
 *
 * NO `authGuard` is applied at this level — the BI surface is
 * `@Public()` on the backend and the dashboard is required to be
 * reachable without a JWT (PLAN §2.3 decision row 1).
 *
 * Children use `loadComponent` so the 3 pages ship in 3 separate
 * chunks; the resumen page (the most frequently visited landing)
 * stays the default for `/dashboard`.
 */
export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: DashboardShellComponent,
    children: [
      { path: '', redirectTo: 'resumen', pathMatch: 'full' },
      {
        path: 'resumen',
        loadComponent: () => import('./pages/resumen/resumen.page').then((m) => m.ResumenPage),
      },
      {
        path: 'analisis',
        loadComponent: () => import('./pages/analisis/analisis.page').then((m) => m.AnalisisPage),
      },
      {
        path: 'encuesta',
        loadComponent: () => import('./pages/encuesta/encuesta.page').then((m) => m.EncuestaPage),
      },
    ],
  },
];
