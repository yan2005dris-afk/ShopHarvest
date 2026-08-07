import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;
    guard = new RolesGuard(reflector);
  });

  const contextWithUser = (user: unknown) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  it('passes when the route declares no roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWithUser({ role: 'user' }))).toBe(true);
  });

  it('allows an admin on an admin-only route', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(guard.canActivate(contextWithUser({ role: 'admin' }))).toBe(true);
  });

  it('rejects a plain user on an admin-only route', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(guard.canActivate(contextWithUser({ role: 'user' }))).toBe(false);
  });

  it('fails closed when the request has no verified user', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(false);
  });

  it('fails closed when the role claim is unknown/malformed', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(guard.canActivate(contextWithUser({ role: 'root' }))).toBe(false);
    expect(guard.canActivate(contextWithUser({}))).toBe(false);
  });
});
