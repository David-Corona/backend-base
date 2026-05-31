import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { ForbiddenException, UnauthorizedException } from '@/common/exceptions';
import { PERMISSIONS } from '@/common/permissions';

function createMockContext(user?: { userId: string; roleId: string; permissions: string[] }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it('allows access when no permissions are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ userId: 'user-1', roleId: 'role-1', permissions: [] });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('allows access when user has all required permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [PERMISSIONS.ROLES_READ, PERMISSIONS.ROLES_WRITE];
      return undefined;
    });

    const context = createMockContext({
      userId: 'user-1',
      roleId: 'role-1',
      permissions: [PERMISSIONS.ROLES_READ, PERMISSIONS.ROLES_WRITE],
    });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('denies access when user lacks required permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [PERMISSIONS.ROLES_READ, PERMISSIONS.ROLES_DELETE];
      return undefined;
    });

    const context = createMockContext({
      userId: 'user-1',
      roleId: 'role-1',
      permissions: [PERMISSIONS.ROLES_READ],
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows access for public routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return true;
      return undefined;
    });

    const context = createMockContext();
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('denies access when user has no roleId', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [PERMISSIONS.ROLES_READ];
      return undefined;
    });

    const context = createMockContext({ userId: 'user-1', roleId: '', permissions: [] });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('denies access when user object is undefined', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [PERMISSIONS.ROLES_READ];
      return undefined;
    });

    const context = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
