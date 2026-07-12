import { Routes } from '@angular/router';
import { VisualMapperPage } from './pages/visual-mapper/visual-mapper.page';
import { ProductsComponent } from './pages/products/products.component';
import { ExtensionSetupComponent } from './pages/extension-setup/extension-setup.component';
import { SourcesComponent } from './pages/sources/sources.component';
import { CategoriesComponent } from './pages/categories/categories.component';
import { LoginComponent } from './pages/login/login.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: VisualMapperPage, canActivate: [authGuard] },
  { path: 'products', component: ProductsComponent, canActivate: [authGuard] },
  { path: 'categories', component: CategoriesComponent, canActivate: [authGuard] },
  { path: 'setup', component: ExtensionSetupComponent, canActivate: [authGuard] },
  { path: 'sources', component: SourcesComponent, canActivate: [authGuard] },
  // Public BI dashboard — no `authGuard`. The whole analytics API is
  // `@Public()` on the backend so this route is reachable without a
  // JWT, matching the dashboard's PLAN §2.3 decision row 1.
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./pages/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
  },
];
