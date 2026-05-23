import { Test, TestingModule } from '@nestjs/testing';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { Logger } from 'nestjs-pino';
import { TasksService } from './tasks.service';
import { AuthService } from '@/modules/auth/auth.service';

describe('TasksService', () => {
  let service: TasksService;
  let authService: DeepMockProxy<AuthService>;
  let logger: DeepMockProxy<Logger>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: AuthService, useValue: mockDeep<AuthService>() },
        { provide: Logger, useValue: mockDeep<Logger>() },
      ],
    }).compile();

    service = module.get(TasksService);
    authService = module.get(AuthService);
    logger = module.get(Logger);
  });

  describe('cleanupExpiredSessions', () => {
    it('calls authService.cleanupExpiredSessions and logs success', async () => {
      authService.cleanupExpiredSessions.mockResolvedValue({ count: 5 });

      await service.cleanupExpiredSessions();

      expect(authService.cleanupExpiredSessions).toHaveBeenCalledTimes(1);
    });

    it('logs error when authService throws', async () => {
      const error = new Error('DB error');
      authService.cleanupExpiredSessions.mockRejectedValue(error);

      await service.cleanupExpiredSessions();

      expect(authService.cleanupExpiredSessions).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredVerificationTokens', () => {
    it('calls authService.cleanupExpiredVerificationTokens and logs success', async () => {
      authService.cleanupExpiredVerificationTokens.mockResolvedValue({ count: 3 });

      await service.cleanupExpiredVerificationTokens();

      expect(authService.cleanupExpiredVerificationTokens).toHaveBeenCalledTimes(1);
    });

    it('logs error when authService throws', async () => {
      const error = new Error('DB error');
      authService.cleanupExpiredVerificationTokens.mockRejectedValue(error);

      await service.cleanupExpiredVerificationTokens();

      expect(authService.cleanupExpiredVerificationTokens).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
