import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { Logger } from 'nestjs-pino';
import { TasksService } from './tasks.service';
import { AuthService } from '@/modules/auth/auth.service';
import { SessionService } from '@/modules/sessions/session.service';

describe('TasksService', () => {
  let service: TasksService;
  let authService: DeepMockProxy<AuthService>;
  let sessionService: DeepMockProxy<SessionService>;
  let logger: DeepMockProxy<Logger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: AuthService, useValue: mockDeep<AuthService>() },
        { provide: SessionService, useValue: mockDeep<SessionService>() },
        { provide: Logger, useValue: mockDeep<Logger>() },
      ],
    }).compile();

    service = module.get(TasksService);
    authService = module.get(AuthService);
    sessionService = module.get(SessionService);
    logger = module.get(Logger);
  });

  describe('cleanupExpiredSessions', () => {
    it('calls sessionService.cleanupExpiredSessions and logs success', async () => {
      sessionService.cleanupExpiredSessions.mockResolvedValue({ count: 5 });

      await service.cleanupExpiredSessions();

      expect(sessionService.cleanupExpiredSessions).toHaveBeenCalledTimes(1);
      expect(logger.log).toHaveBeenCalledWith(
        { deletedCount: 5 },
        'Expired session cleanup complete',
      );
    });

    it('logs error when sessionService throws', async () => {
      const error = new Error('DB error');
      sessionService.cleanupExpiredSessions.mockRejectedValue(error);

      await service.cleanupExpiredSessions();

      expect(sessionService.cleanupExpiredSessions).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        { err: error },
        'Expired session cleanup failed',
      );
    });
  });

  describe('cleanupExpiredVerificationTokens', () => {
    it('calls authService.cleanupExpiredVerificationTokens and logs success', async () => {
      authService.cleanupExpiredVerificationTokens.mockResolvedValue({ count: 3 });

      await service.cleanupExpiredVerificationTokens();

      expect(authService.cleanupExpiredVerificationTokens).toHaveBeenCalledTimes(1);
      expect(logger.log).toHaveBeenCalledWith(
        { deletedCount: 3 },
        'Expired verification token cleanup complete',
      );
    });

    it('logs error when authService throws', async () => {
      const error = new Error('DB error');
      authService.cleanupExpiredVerificationTokens.mockRejectedValue(error);

      await service.cleanupExpiredVerificationTokens();

      expect(authService.cleanupExpiredVerificationTokens).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        { err: error },
        'Expired verification token cleanup failed',
      );
    });
  });
});
