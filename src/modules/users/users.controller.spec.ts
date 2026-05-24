import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SessionService } from '@/modules/auth/session.service';
import { SessionResponseDto } from '@/common/dto/session-response.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let sessionService: jest.Mocked<SessionService>;

  const mockSessionResponse: SessionResponseDto = {
    id: 'session-1',
    isCurrent: false,
    userAgent: 'Mozilla/5.0',
    ip: '127.0.0.1',
    expiresAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {},
        },
        {
          provide: SessionService,
          useValue: {
            listSessions: jest.fn(),
            terminateSession: jest.fn(),
            terminateAllSessions: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(UsersController);
    sessionService = module.get(SessionService);
  });

  describe('listUserSessions', () => {
    it('returns sessions for the given user', async () => {
      sessionService.listSessions.mockResolvedValue([mockSessionResponse]);

      const result = await controller.listUserSessions('user-1');

      expect(sessionService.listSessions).toHaveBeenCalledWith('user-1');
      expect(result).toEqual([mockSessionResponse]);
    });
  });

  describe('terminateUserSession', () => {
    it('terminates a specific session for the given user', async () => {
      await controller.terminateUserSession('user-1', 'session-1');

      expect(sessionService.terminateSession).toHaveBeenCalledWith('session-1', { userId: 'user-1' });
    });
  });

  describe('terminateAllUserSessions', () => {
    it('terminates all sessions for the given user', async () => {
      await controller.terminateAllUserSessions('user-1');

      expect(sessionService.terminateAllSessions).toHaveBeenCalledWith('user-1');
    });
  });
});
