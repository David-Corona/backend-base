import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { SessionResponseDto } from '@/common/dto/session-response.dto';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let sessionService: jest.Mocked<SessionService>;

  const mockSessionResponse: SessionResponseDto = {
    id: 'session-1',
    isCurrent: true,
    userAgent: 'Chrome/120',
    ip: '1.2.3.4',
    expiresAt: new Date(Date.now() + 86_400_000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPaginatedSessions: PaginatedResponse<SessionResponseDto> = {
    data: [mockSessionResponse],
    meta: { total: 1, page: 1, limit: 25, totalPages: 1 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {},
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn() },
        },
        {
          provide: SessionService,
          useValue: {
            listSessions: jest.fn(),
            terminateSession: jest.fn(),
            terminateAllOtherSessions: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    sessionService = module.get(SessionService);
  });

  describe('listSessions', () => {
    it('returns paginated sessions for the current user', async () => {
      sessionService.listSessions.mockResolvedValue(mockPaginatedSessions);

      const result = await controller.listSessions('user-id', 'session-1', { page: 1, limit: 25 });

      expect(sessionService.listSessions).toHaveBeenCalledWith('user-id', 'session-1', 1, 25);
      expect(result).toEqual(mockPaginatedSessions);
    });
  });

  describe('terminateSession', () => {
    it('terminates a specific session for the current user', async () => {
      await controller.terminateSession('session-2', 'user-id', 'session-1');

      expect(sessionService.terminateSession).toHaveBeenCalledWith('session-2', {
        userId: 'user-id',
        currentSessionId: 'session-1',
      });
    });
  });

  describe('terminateAllOtherSessions', () => {
    it('terminates all sessions except the current one', async () => {
      await controller.terminateAllOtherSessions('user-id', 'session-1');

      expect(sessionService.terminateAllOtherSessions).toHaveBeenCalledWith('user-id', 'session-1');
    });
  });
});
