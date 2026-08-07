import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import type { AuthResponseDto, AuthUserDto } from '@web-scraping/contracts/auth';
import { ExtensionService } from './extension.service';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'vs_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly extension = inject(ExtensionService);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  readonly user = signal<AuthUserDto | null>(null);

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getAccessToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  register(email: string, password: string): Observable<AuthResponseDto> {
    return this.http
      .post<AuthResponseDto>(`${this.baseUrl}/register`, { email, password })
      .pipe(tap((res) => this.handleAuth(res)));
  }

  login(email: string, password: string): Observable<AuthResponseDto> {
    return this.http
      .post<AuthResponseDto>(`${this.baseUrl}/login`, { email, password })
      .pipe(tap((res) => this.handleAuth(res)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.user.set(null);
  }

  private handleAuth(res: AuthResponseDto): void {
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    this.user.set(res.user);
    // Hand the token to the extension so its background scheduler can call the
    // protected API. Best-effort — silently ignore if the extension is absent.
    this.extension.setAuthToken(res.accessToken).catch(() => undefined);
  }
}
