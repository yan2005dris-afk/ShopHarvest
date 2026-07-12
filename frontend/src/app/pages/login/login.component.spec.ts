import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { LoginComponent } from './login.component';
import { AuthService } from '../../services/auth.service';

describe('LoginComponent', () => {
  function createComponent(returnUrl: string | null) {
    const authMock = {
      login: vi.fn(),
      register: vi.fn(),
    };
    const routerMock = {
      navigate: vi.fn(),
      navigateByUrl: vi.fn(),
    };
    const routeMock = {
      snapshot: {
        queryParamMap: {
          get: (key: string) => (key === 'returnUrl' ? returnUrl : null),
          has: (key: string) => key === 'returnUrl' && returnUrl !== null,
          getAll: () => [],
          keys: returnUrl ? ['returnUrl'] : [],
        },
      },
    };

    TestBed.configureTestingModule({
      imports: [LoginComponent, FormsModule],
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: routeMock },
      ],
    });

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture, component, authMock, routerMock };
  }

  it('navigates to returnUrl on successful login when returnUrl param is present', () => {
    const { component, authMock, routerMock } = createComponent('/etl-management');
    component.email = 'test@example.com';
    component.password = 'secret';
    authMock.login.mockReturnValue(of({ accessToken: 'jwt', user: {} as any }));

    component.submit();

    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/etl-management');
  });

  it('navigates to root on successful login when no returnUrl param', () => {
    const { component, authMock, routerMock } = createComponent(null);
    component.email = 'test@example.com';
    component.password = 'secret';
    authMock.login.mockReturnValue(of({ accessToken: 'jwt', user: {} as any }));

    component.submit();

    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('navigates to returnUrl after registration too', () => {
    const { component, authMock, routerMock } = createComponent('/etl-management?page=2');
    component.email = 'new@example.com';
    component.password = 'password';
    component.toggleMode(); // switch to register
    authMock.register.mockReturnValue(of({ accessToken: 'jwt', user: {} as any }));

    component.submit();

    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/etl-management?page=2');
  });
});
