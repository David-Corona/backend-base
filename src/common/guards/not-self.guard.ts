import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenException, UnauthorizedException } from '@/common/exceptions';

@Injectable()
export class NotSelfGuard implements CanActivate {
   
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.params.id;
    const currentUserId = (request.user)?.userId;

    if (!currentUserId) {
      throw new UnauthorizedException('AUTH_REQUIRED', 'Authentication required');
    }

    if (!userId) {
      // Missing params.id is a routing error, let NestJS handle it
      return true;
    }

    if (userId === currentUserId) {
      throw new ForbiddenException('CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own account');
    }

    return true;
  }
   
}
