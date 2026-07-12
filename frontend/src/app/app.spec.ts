import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AuthService } from './services/auth.service';
import { vi } from 'vitest';

describe('App', () => {
  let authMock: {
    isAuthenticated: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    user: any;
  };

  beforeEach(async () => {
    // Mock localStorage for ThemeService (not available in Node test env)
    const storage: Record<string, string> = {};
    const lsMock: Storage = {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
      get length() { return Object.keys(storage).length; },
      key: (index: number) => Object.keys(storage)[index] ?? null,
    };
    Object.defineProperty(globalThis, 'localStorage', { value: lsMock, configurable: true });

    // Mock window.matchMedia
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'matchMedia', {
        value: (query: string) => ({
          matches: false,
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }),
        configurable: true,
        writable: true,
      });
    }

    authMock = {
      isAuthenticated: vi.fn().mockReturnValue(false),
      logout: vi.fn(),
      user: { set: vi.fn() },
    };

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-icon')).toBeTruthy();
    expect(compiled.textContent).toContain('Scraper Studio');
  });

  it('should hide ETL nav link when unauthenticated', async () => {
    authMock.isAuthenticated.mockReturnValue(false);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const etlLink = compiled.querySelector('a[routerLink="/etl-management"]');
    expect(etlLink).toBeNull();
  });

  it('should show ETL nav link when authenticated', async () => {
    authMock.isAuthenticated.mockReturnValue(true);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    const etlLink = compiled.querySelector('a[routerLink="/etl-management"]');
    expect(etlLink).toBeTruthy();
    expect(etlLink?.textContent?.trim()).toBe('ETL');
  });
});
