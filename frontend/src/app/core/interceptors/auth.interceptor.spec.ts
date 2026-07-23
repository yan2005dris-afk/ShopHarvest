import { TestBed } from '@angular/core/testing';
import {
  HttpHeaders,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpResponse,
} from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../../services/auth.service';

/**
 * Contract: the interceptor must only attach Authorization: Bearer to
 * same-origin /api/ requests. External URLs (CDNs, third-party APIs, etc.)
 * must NOT leak the JWT — that puts credentials where the user never
 * expected and a hostile proxy could capture them.
 *
 * We drive the interceptor as a plain function inside TestBed's injection
 * context instead of using HttpClient + HttpTestingController. That keeps
 * these tests independent of the pre-existing chrome namespace compile
 * errors in extension.service.ts which currently break `ng test` on the
 * branch; the assertions below match the production interceptor logic.
 */
describe('authInterceptor', () => {
  /**
   * Build a no-op HttpHandlerFn that captures the request the interceptor
   * passes down the chain. Returns the captured request so the test can
   * inspect Authorization headers.
   */
  function captureHandler(captured: { req: HttpRequest<unknown> | null }): HttpHandlerFn {
    return (req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> => {
      captured.req = req;
      return of(new HttpResponse({ status: 200 }));
    };
  }

  function bootstrapWithToken(token: string | null): void {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            get token(): string | null {
              return token;
            },
            logout: () => undefined,
          },
        },
        { provide: Router, useValue: { navigate: () => Promise.resolve() } },
      ],
    });
  }

  function runInterceptor(url: string, token: string | null): HttpRequest<unknown> {
    bootstrapWithToken(token);
    const captured: { req: HttpRequest<unknown> | null } = { req: null };
    TestBed.runInInjectionContext(() => {
      authInterceptor(new HttpRequest('GET', url), captureHandler(captured)).subscribe();
    });
    if (captured.req === null) {
      throw new Error('interceptor did not forward the request');
    }
    return captured.req;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('attaches Authorization: Bearer <token> to /api/ requests', () => {
    const req = runInterceptor('/api/auth/me', 'jwt-abc');
    expect(req.headers.get('Authorization')).toBe('Bearer jwt-abc');
  });

  it('attaches Authorization to /api/* requests with query strings', () => {
    const req = runInterceptor('/api/products?limit=10', 'jwt-abc');
    expect(req.headers.get('Authorization')).toBe('Bearer jwt-abc');
  });

  it('does NOT attach Authorization to non-/api/ same-origin requests', () => {
    const req = runInterceptor('/assets/logo.png', 'jwt-abc');
    expect(req.headers.has('Authorization')).toBe(false);
  });

  it('does NOT attach Authorization to relative paths that start with /api- but not /api/', () => {
    // /apify, /apiary, etc. — only paths that start with /api/ count.
    const req = runInterceptor('/apify/some-resource', 'jwt-abc');
    expect(req.headers.has('Authorization')).toBe(false);
  });

  it('does NOT attach Authorization to absolute external URLs', () => {
    const req = runInterceptor('https://cdn.example.com/data.json', 'jwt-abc');
    expect(req.headers.has('Authorization')).toBe(false);
  });

  it('omits Authorization when no token is present (does not send empty Bearer)', () => {
    const req = runInterceptor('/api/auth/me', null);
    expect(req.headers.has('Authorization')).toBe(false);
  });

  it('preserves any pre-existing headers on the request', () => {
    const req = new HttpRequest('GET', '/api/auth/me', {
      headers: new HttpHeaders({ 'X-Trace': 'abc' }),
    });
    const captured: { req: HttpRequest<unknown> | null } = { req: null };
    bootstrapWithToken('jwt-abc');
    TestBed.runInInjectionContext(() => {
      authInterceptor(req, captureHandler(captured)).subscribe();
    });
    const forwarded = captured.req as HttpRequest<unknown>;
    expect(forwarded.headers.get('X-Trace')).toBe('abc');
    expect(forwarded.headers.get('Authorization')).toBe('Bearer jwt-abc');
  });
});
