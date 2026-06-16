import { Routes } from '@angular/router';
import { UrlInputComponent } from './pages/url-input/url-input.component';
import { VisualMapperComponent } from './pages/visual-mapper/visual-mapper.component';

export const routes: Routes = [
  { path: '', redirectTo: '/url-input', pathMatch: 'full' },
  { path: 'url-input', component: UrlInputComponent },
  { path: 'visual-mapper', component: VisualMapperComponent },
];
