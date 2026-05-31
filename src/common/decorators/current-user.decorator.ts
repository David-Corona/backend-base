import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@/common/exceptions';

export const CurrentUser = createParamDecorator(
  (
    data: keyof { userId: string; roleId: string; sessionId: string; permissions: string[] } | undefined,
    ctx: ExecutionContext,
  ) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('AUTH_REQUIRED', 'Authentication required');
    }
    return data ? user[data] : user;
  },
);
