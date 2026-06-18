import { Test, TestingModule } from '@nestjs/testing';
import { SessionsController } from './sessions.controller';
import { SessionService } from './session.service';
import type { AdminSessionResponseDto } from './dto/admin-session-response.dto';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import { SessionNotFoundException } from './sessions.exceptions';

describe('SessionsController', () => {
  let controller: SessionsController;
  let sessionService: jest.Mocked<SessionService>;

  const mockNow = new Date('2024-06-15T12:00:00.000Z');
  const mockFuture = new Date('2024-06-22T12:00:00.000Z');

  const mockAdminSession: AdminSessionResponseDto = {
    id: 'session-1',
    user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
    userAgent: 'Chrome/120',
    ip: '1.2.3.4',
    isExpired: false,
    expiresAt: mockFuture,
    createdAt: mockNow,
    updatedAt: mockNow,
  };

  const mockPaginatedSessions: PaginatedResponse<AdminSessionResponseDto> = {
    data: [mockAdminSession],
    meta: { total: 1, page: 1, limit: 25, totalPages: 1 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        {
          provide: SessionService,
          useValue: {
            listAllSessions: jest.fn(),
            findSessionById: jest.fn(),
            terminateSession: jest.fn(),
            terminateAllSessions: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(SessionsController);
    sessionService = module.get(SessionService);
  });

  describe('findAll', () => {
    it('returns paginated sessions with default filters', async () => {
      sessionService.listAllSessions.mockResolvedValue(mockPaginatedSessions);

      const result = await controller.findAll({
        page: 1,
        limit: 25,
        includeExpired: false,
      });

      expect(sessionService.listAllSessions).toHaveBeenCalledWith(
        {
          userId: undefined,
          ip: undefined,
          userAgent: undefined,
          includeExpired: false,
          createdAfter: undefined,
          createdBefore: undefined,
        },
        1,
        25,
      );
      expect(result).toEqual(mockPaginatedSessions);
    });

    it('passes userId filter', async () => {
      sessionService.listAllSessions.mockResolvedValue(mockPaginatedSessions);

      await controller.findAll({
        page: 1,
        limit: 25,
        userId: 'user-1',
        includeExpired: false,
      });

      expect(sessionService.listAllSessions).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1' }),
        1,
        25,
      );
    });

    it('passes ip filter', async () => {
      sessionService.listAllSessions.mockResolvedValue(mockPaginatedSessions);

      await controller.findAll({
        page: 1,
        limit: 25,
        ip: '192.168',
        includeExpired: false,
      });

      expect(sessionService.listAllSessions).toHaveBeenCalledWith(
        expect.objectContaining({ ip: '192.168' }),
        1,
        25,
      );
    });

    it('passes userAgent filter', async () => {
      sessionService.listAllSessions.mockResolvedValue(mockPaginatedSessions);

      await controller.findAll({
        page: 1,
        limit: 25,
        userAgent: 'Firefox',
        includeExpired: false,
      });

      expect(sessionService.listAllSessions).toHaveBeenCalledWith(
        expect.objectContaining({ userAgent: 'Firefox' }),
        1,
        25,
      );
    });

    it('passes includeExpired filter', async () => {
      sessionService.listAllSessions.mockResolvedValue(mockPaginatedSessions);

      await controller.findAll({
        page: 1,
        limit: 25,
        includeExpired: true,
      });

      expect(sessionService.listAllSessions).toHaveBeenCalledWith(
        expect.objectContaining({ includeExpired: true }),
        1,
        25,
      );
    });

    it('passes date range filters', async () => {
      sessionService.listAllSessions.mockResolvedValue(mockPaginatedSessions);

      await controller.findAll({
        page: 1,
        limit: 25,
        createdAfter: '2024-01-01T00:00:00.000Z',
        createdBefore: '2024-12-31T23:59:59.999Z',
        includeExpired: false,
      });

      expect(sessionService.listAllSessions).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAfter: '2024-01-01T00:00:00.000Z',
          createdBefore: '2024-12-31T23:59:59.999Z',
        }),
        1,
        25,
      );
    });
  });

  describe('findOne', () => {
    it('returns a session by id', async () => {
      sessionService.findSessionById.mockResolvedValue(mockAdminSession);

      const result = await controller.findOne('session-1');

      expect(sessionService.findSessionById).toHaveBeenCalledWith('session-1');
      expect(result).toEqual(mockAdminSession);
    });

    it('propagates SessionNotFoundException', async () => {
      sessionService.findSessionById.mockRejectedValue(new SessionNotFoundException());

      await expect(controller.findOne('nonexistent')).rejects.toThrow(SessionNotFoundException);
    });
  });

  describe('terminate', () => {
    it('terminates a session by id', async () => {
      sessionService.terminateSession.mockResolvedValue();

      await controller.terminate('session-1');

      expect(sessionService.terminateSession).toHaveBeenCalledWith('session-1');
    });
  });

  describe('terminateByUser', () => {
    it('terminates all sessions for a user', async () => {
      sessionService.terminateAllSessions.mockResolvedValue();

      await controller.terminateByUser({ userId: 'user-1' });

      expect(sessionService.terminateAllSessions).toHaveBeenCalledWith('user-1');
    });
  });
});
