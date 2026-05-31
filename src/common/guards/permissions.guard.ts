import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ForbiddenException, UnauthorizedException } from '@/common/exceptions';
import { PERMISSIONS_KEY } from '@/common/decorators/require-permissions.decorator';
import type { Permission } from '@/common/permissions';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
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
    const user = request.user as { userId: string; roleId: string; permissions: string[] } | undefined;

    if (!user) {
      throw new UnauthorizedException('AUTH_REQUIRED', 'Authentication required');
    }

    if (!user.roleId) {
      throw new ForbiddenException('PERMISSION_DENIED', 'Permission denied');
    }

    const userPermissionSet = new Set(user.permissions);

    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissionSet.has(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('PERMISSION_DENIED', 'Permission denied');
    }

    return true;
  }
}
