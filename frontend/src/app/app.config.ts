import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Order matters: authInterceptor attaches the Bearer header first;
    // errorInterceptor observes the response and surfaces non-401
    // failures as a toast. 401 stays inside authInterceptor's chain.
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
  ],
};
