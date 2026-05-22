import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesService } from '@/modules/roles/roles.service';
import { ForbiddenException } from '@/common/exceptions';
import { PERMISSIONS_KEY } from '@/common/decorators/require-permissions.decorator';
import type { Permission } from '@/common/permissions';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rolesService: RolesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { userId: string; roleId: string } | undefined;

    if (!user?.roleId) {
      throw new ForbiddenException('PERMISSION_DENIED', 'Permission denied');
    }

    const userPermissions = await this.rolesService.getPermissionsForRole(user.roleId);
    const userPermissionSet = new Set(userPermissions);

    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissionSet.has(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('PERMISSION_DENIED', 'Permission denied');
    }

    return true;
  }
}
