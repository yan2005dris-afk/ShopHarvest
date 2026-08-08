import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideAppInitializer,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { registerBoneyardPresets } from './core/boneyard.setup';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAnimationsAsync(),
    // Order matters: authInterceptor attaches the Bearer header first;
    // errorInterceptor observes the response and surfaces non-401
    // failures as a toast. 401 stays inside authInterceptor's chain.
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    // boneyard-js: register the card / kpi / sourceRow presets once
    // at app boot. Runs synchronously — the registry is global.
    provideAppInitializer(() => {
      registerBoneyardPresets();
    }),
  ],
};
