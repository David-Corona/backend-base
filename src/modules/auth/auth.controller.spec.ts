import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { SessionResponseDto } from '@/common/dto/session-response.dto';

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
  };

  const mockReq = (overrides?: Partial<Request>): Request =>
    ({
      user: { userId: 'user-id', roleId: 'role-1', sessionId: 'session-1' },
      ...overrides,
    }) as unknown as Request;

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
    it('returns sessions for the current user', async () => {
      sessionService.listSessions.mockResolvedValue([mockSessionResponse]);

      const result = await controller.listSessions(mockReq());

      expect(sessionService.listSessions).toHaveBeenCalledWith('user-id', 'session-1');
      expect(result).toEqual([mockSessionResponse]);
    });
  });

  describe('terminateSession', () => {
    it('terminates a specific session for the current user', async () => {
      await controller.terminateSession(mockReq(), 'session-2');

      expect(sessionService.terminateSession).toHaveBeenCalledWith('session-2', {
        userId: 'user-id',
        currentSessionId: 'session-1',
      });
    });
  });

  describe('terminateAllOtherSessions', () => {
    it('terminates all sessions except the current one', async () => {
      await controller.terminateAllOtherSessions(mockReq());

      expect(sessionService.terminateAllOtherSessions).toHaveBeenCalledWith('user-id', 'session-1');
    });
  });
});
