import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PermissionsGuard } from './permissions.guard';
import { RolesService } from '@/modules/roles/roles.service';
import { ForbiddenException, UnauthorizedException } from '@/common/exceptions';
import { PERMISSIONS } from '@/common/permissions';

function createMockContext(user?: { userId: string; roleId: string }): ExecutionContext {
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
  let rolesService: DeepMockProxy<RolesService>;

  beforeEach(() => {
    reflector = new Reflector();
    rolesService = mockDeep<RolesService>();
    guard = new PermissionsGuard(reflector, rolesService);
  });

  it('allows access when no permissions are required', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext({ userId: 'user-1', roleId: 'role-1' });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('allows access when user has all required permissions', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [PERMISSIONS.ROLES_READ, PERMISSIONS.ROLES_WRITE];
      return undefined;
    });

    rolesService.getPermissionsForRole.mockResolvedValue([
      PERMISSIONS.ROLES_READ,
      PERMISSIONS.ROLES_WRITE,
    ]);

    const context = createMockContext({ userId: 'user-1', roleId: 'role-1' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(rolesService.getPermissionsForRole).toHaveBeenCalledWith('role-1');
  });

  it('denies access when user lacks required permissions', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [PERMISSIONS.ROLES_READ, PERMISSIONS.ROLES_DELETE];
      return undefined;
    });

    rolesService.getPermissionsForRole.mockResolvedValue([PERMISSIONS.ROLES_READ]);

    const context = createMockContext({ userId: 'user-1', roleId: 'role-1' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('allows access for public routes', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return true;
      return undefined;
    });

    const context = createMockContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('denies access when user has no roleId', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [PERMISSIONS.ROLES_READ];
      return undefined;
    });

    const context = createMockContext({ userId: 'user-1', roleId: '' });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('denies access when user object is undefined', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === 'isPublic') return false;
      if (key === 'permissions') return [PERMISSIONS.ROLES_READ];
      return undefined;
    });

    const context = createMockContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
