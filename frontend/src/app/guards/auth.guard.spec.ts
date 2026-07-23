import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  /** Helper: run the guard inside TestBed's injection context. */
  function runGuard(url: string, isAuthenticated: boolean): any {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { isAuthenticated: () => isAuthenticated },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: (commands: any[], extras?: any) =>
              ({ commands, extras }) as unknown as UrlTree,
          },
        },
      ],
    });

    const route = {} as any;
    const state = { url } as any;
    return TestBed.runInInjectionContext(() => authGuard(route, state));
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('returns true when the user is authenticated', () => {
    const result = runGuard('/etl-management', true);
    expect(result).toBe(true);
  });

  it('redirects to /login with returnUrl when unauthenticated', () => {
    const result = runGuard('/etl-management', false) as UrlTree & {
      commands: any[];
      extras: any;
    };
    expect(result.commands).toEqual(['/login']);
    expect(result.extras).toEqual({ queryParams: { returnUrl: '/etl-management' } });
  });

  it('uses the full attempted URL including query string as returnUrl', () => {
    const result = runGuard('/etl-management?page=2&status=FAILED', false) as UrlTree & {
      commands: any[];
      extras: any;
    };
    expect(result.commands).toEqual(['/login']);
    expect(result.extras).toEqual({
      queryParams: { returnUrl: '/etl-management?page=2&status=FAILED' },
    });
  });

  it('redirects any protected route with its own URL as returnUrl', () => {
    const result = runGuard('/products', false) as UrlTree & {
      commands: any[];
      extras: any;
    };
    expect(result.commands).toEqual(['/login']);
    expect(result.extras).toEqual({ queryParams: { returnUrl: '/products' } });
  });
});
