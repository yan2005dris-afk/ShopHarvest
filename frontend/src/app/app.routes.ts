import { Routes } from '@angular/router';
import { VisualMapperComponent } from './pages/visual-mapper/visual-mapper.component';
import { ProductsComponent } from './pages/products/products.component';

export const routes: Routes = [
  { path: '', component: VisualMapperComponent },
  { path: 'products', component: ProductsComponent },
];
