import { ExecutionContext } from '@nestjs/common';
import { NotSelfGuard } from './not-self.guard';
import { ForbiddenException, UnauthorizedException } from '@/common/exceptions';

function createMockContext(params: { id?: string }, user?: { userId?: string }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ params, user }),
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  } as unknown as ExecutionContext;
}

describe('NotSelfGuard', () => {
  let guard: NotSelfGuard;

  beforeEach(() => {
    guard = new NotSelfGuard();
  });

  it('allows access when deactivating a different user', () => {
    const context = createMockContext({ id: 'user-2' }, { userId: 'user-1' });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('throws ForbiddenException when deactivating own account', () => {
    const context = createMockContext({ id: 'user-1' }, { userId: 'user-1' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows access when params.id is missing', () => {
    const context = createMockContext({}, { userId: 'user-1' });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('throws UnauthorizedException when request.user is missing', () => {
    const context = createMockContext({ id: 'user-1' }, undefined);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when user.userId is missing', () => {
    const context = createMockContext({ id: 'user-1' }, {});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});

