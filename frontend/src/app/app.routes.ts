import { Routes } from '@angular/router';
import { VisualMapperComponent } from './pages/visual-mapper/visual-mapper.component';
import { ProductsComponent } from './pages/products/products.component';
import { ExtensionSetupComponent } from './pages/extension-setup/extension-setup.component';
import { LoginComponent } from './pages/login/login.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: VisualMapperComponent, canActivate: [authGuard] },
  { path: 'products', component: ProductsComponent, canActivate: [authGuard] },
  { path: 'setup', component: ExtensionSetupComponent, canActivate: [authGuard] },
];
