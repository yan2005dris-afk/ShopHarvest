import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { ExtensionService } from './extension.service';

interface AuthResponse {
  accessToken: string;
  user: { id: string; email: string };
}

const TOKEN_KEY = 'vs_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly extension = inject(ExtensionService);
  private readonly baseUrl = '/api/auth';

  readonly user = signal<{ id: string; email: string } | null>(null);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  register(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/register`, { email, password })
      .pipe(tap((res) => this.handleAuth(res)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, { email, password })
      .pipe(tap((res) => this.handleAuth(res)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.user.set(null);
  }

  private handleAuth(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    this.user.set(res.user);
    // Hand the token to the extension so its background scheduler can call the
    // protected API. Best-effort — silently ignore if the extension is absent.
    this.extension.setAuthToken(res.accessToken).catch(() => undefined);
  }
}
