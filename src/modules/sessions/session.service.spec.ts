import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SessionService } from './session.service';
import {
  SessionNotFoundException,
  CannotTerminateCurrentSessionException,
} from './sessions.exceptions';

describe('SessionService', () => {
  let service: SessionService;

  const mockPrismaService = {
    session: {
      create: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
      return callback(mockPrismaService);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get(SessionService);
  });

  describe('create', () => {
    it('creates a new session', async () => {
      (mockPrismaService.session.create).mockResolvedValue({ id: 'session-id' });

      const result = await service.create({
        userId: 'user-id',
        tokenHash: 'hash',
        expiresAt: new Date(),
        userAgent: 'Chrome',
        ip: '1.2.3.4',
      });

      expect(result).toEqual({ id: 'session-id' });
    });
  });

  describe('createInTransaction', () => {
    it('creates a session within a transaction', async () => {
      (mockPrismaService.session.create).mockResolvedValue({ id: 'session-id' });

      const result = await service.createInTransaction(mockPrismaService as never, {
        userId: 'user-id',
        tokenHash: 'hash',
        expiresAt: new Date(),
      });

      expect(result).toEqual({ id: 'session-id' });
    });
  });

  describe('deleteSessionByTokenHash', () => {
    it('deletes sessions by token hash', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteSessionByTokenHash('some-hash');

      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { tokenHash: 'some-hash' },
      });
    });
  });

  describe('findByTokenHash', () => {
    it('returns session data for a valid token hash', async () => {
      const expiresAt = new Date(Date.now() + 86_400_000);
      mockPrismaService.session.findUnique.mockResolvedValue({
        id: 'session-id',
        userId: 'user-id',
        expiresAt,
        userAgent: 'Chrome/120',
        ip: '1.2.3.4',
      });

      const result = await service.findByTokenHash('hash');

      expect(result).toEqual({
        id: 'session-id',
        userId: 'user-id',
        expiresAt,
        userAgent: 'Chrome/120',
        ip: '1.2.3.4',
      });
      expect(mockPrismaService.session.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: 'hash' },
        select: { id: true, userId: true, expiresAt: true, userAgent: true, ip: true },
      });
    });

    it('returns null when session not found', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      const result = await service.findByTokenHash('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('consumeSessionByTokenHashInTransaction', () => {
    it('deletes a session by token hash in a transaction, returning full session data', async () => {
      const expiresAt = new Date(Date.now() + 86_400_000);
      mockPrismaService.session.delete.mockResolvedValue({
        id: 'session-id',
        userId: 'user-id',
        expiresAt,
        userAgent: 'Chrome/120',
        ip: '1.2.3.4',
      });

      const result = await service.consumeSessionByTokenHashInTransaction(mockPrismaService as never, 'hash');

      expect(result).toEqual({ id: 'session-id', userId: 'user-id', expiresAt, userAgent: 'Chrome/120', ip: '1.2.3.4' });
    });

    it('propagates Prisma P2025 error', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record to delete does not exist.',
        { clientVersion: '7.8.0', code: 'P2025' },
      );
      mockPrismaService.session.delete.mockRejectedValue(prismaError);

      await expect(
        service.consumeSessionByTokenHashInTransaction(mockPrismaService as never, 'nonexistent'),
      ).rejects.toThrow(prismaError);
    });
  });

  describe('deleteByUserIdInTransaction', () => {
    it('deletes all sessions for a user in a transaction', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 3 });

      await service.deleteByUserIdInTransaction(mockPrismaService as never, 'user-id');

      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
    });
  });

  describe('findDeviceSession', () => {
    it('returns the most recent active session for matching user, userAgent, and ip', async () => {
      mockPrismaService.session.findFirst.mockResolvedValue({
        id: 'session-id',
      });

      const result = await service.findDeviceSession('user-id', 'Chrome', '1.2.3.4');

      expect(result).toEqual({ id: 'session-id' });
      expect(mockPrismaService.session.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          userAgent: 'Chrome',
          ip: '1.2.3.4',
          expiresAt: { gte: expect.any(Date) },
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns null when no matching session exists', async () => {
      mockPrismaService.session.findFirst.mockResolvedValue(null);

      const result = await service.findDeviceSession('user-id', 'Chrome', '1.2.3.4');

      expect(result).toBeNull();
    });

    it('normalizes undefined to null for userAgent and ip', async () => {
      mockPrismaService.session.findFirst.mockResolvedValue(null);

      await service.findDeviceSession('user-id', undefined, undefined);

      expect(mockPrismaService.session.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          userAgent: null,
          ip: null,
          expiresAt: { gte: expect.any(Date) },
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('findDeviceSessionInTransaction', () => {
    it('returns the most recent active session via transaction client', async () => {
      mockPrismaService.session.findFirst.mockResolvedValue({
        id: 'tx-session-id',
      });

      const result = await service.findDeviceSessionInTransaction(mockPrismaService as never, 'user-id', 'Firefox', '5.6.7.8');

      expect(result).toEqual({ id: 'tx-session-id' });
      expect(mockPrismaService.session.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          userAgent: 'Firefox',
          ip: '5.6.7.8',
          expiresAt: { gte: expect.any(Date) },
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('deleteById', () => {
    it('deletes a session by id', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteById('session-id');

      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'session-id' },
      });
    });
  });

  describe('deleteByIdInTransaction', () => {
    it('deletes a session by id within a transaction', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteByIdInTransaction(mockPrismaService as never, 'session-id');

      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'session-id' },
      });
    });
  });

  describe('deleteOldestUserSessions', () => {
    it('deletes oldest sessions beyond the keep count', async () => {
      mockPrismaService.session.findMany.mockResolvedValue([
        { id: 'session-1' },
        { id: 'session-2' },
      ]);
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 2 });

      await service.deleteOldestUserSessions('user-id', 3);

      expect(mockPrismaService.session.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          expiresAt: { gte: expect.any(Date) },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
        skip: 3,
      });
      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['session-1', 'session-2'] } },
      });
    });

    it('does nothing when user has fewer or equal sessions than keep count', async () => {
      mockPrismaService.session.findMany.mockResolvedValue([]);

      await service.deleteOldestUserSessions('user-id', 5);

      expect(mockPrismaService.session.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteOldestUserSessionsInTransaction', () => {
    it('deletes oldest sessions beyond the keep count via transaction client', async () => {
      mockPrismaService.session.findMany.mockResolvedValue([
        { id: 'session-1' },
      ]);
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.deleteOldestUserSessionsInTransaction(mockPrismaService as never, 'user-id', 2);

      expect(mockPrismaService.session.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          expiresAt: { gte: expect.any(Date) },
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
        skip: 2,
      });
      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['session-1'] } },
      });
    });
  });

  describe('listSessions', () => {
    it('returns paginated sessions, marking the current one', async () => {
      const now = new Date();
      mockPrismaService.session.count.mockResolvedValue(2);
      mockPrismaService.session.findMany.mockResolvedValue([
        {
          id: 'session-1',
          userAgent: 'Chrome',
          ip: '1.2.3.4',
          expiresAt: new Date(now.getTime() + 86_400_000),
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'session-2',
          userAgent: null,
          ip: null,
          expiresAt: new Date(now.getTime() + 86_400_000),
          createdAt: new Date(now.getTime() - 1000),
          updatedAt: new Date(now.getTime() - 1000),
        },
      ] as never);

      const result = await service.listSessions('user-id', 'session-1', 1, 25);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toEqual({
        id: 'session-1',
        isCurrent: true,
        userAgent: 'Chrome',
        ip: '1.2.3.4',
        expiresAt: expect.any(Date),
        createdAt: now,
        updatedAt: now,
      });
      expect(result.data[1]).toEqual({
        id: 'session-2',
        isCurrent: false,
        userAgent: null,
        ip: null,
        expiresAt: expect.any(Date),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 25,
        totalPages: 1,
      });
      expect(mockPrismaService.session.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id', expiresAt: { gte: expect.any(Date) } },
        skip: 0,
        take: 25,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userAgent: true,
          ip: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    });

    it('returns empty paginated result when user has no sessions', async () => {
      mockPrismaService.session.count.mockResolvedValue(0);
      mockPrismaService.session.findMany.mockResolvedValue([]);

      const result = await service.listSessions('user-id');

      expect(result.data).toEqual([]);
      expect(result.meta).toEqual({
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 0,
      });
    });
  });

  describe('terminateSession', () => {
    it('terminates a specific session', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.terminateSession('session-id', { userId: 'user-id' });

      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'session-id', userId: 'user-id' },
      });
    });

    it('throws SessionNotFoundException when session not found', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.terminateSession('nonexistent', { userId: 'user-id' }),
      ).rejects.toThrow(SessionNotFoundException);
    });

    it('throws CannotTerminateCurrentSessionException when terminating current session', async () => {
      await expect(
        service.terminateSession('current-id', { currentSessionId: 'current-id' }),
      ).rejects.toThrow(CannotTerminateCurrentSessionException);

      expect(mockPrismaService.session.deleteMany).not.toHaveBeenCalled();
    });

    it('throws SessionNotFoundException when session belongs to another user', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 0 });

      await expect(
        service.terminateSession('session-id', { userId: 'user-id' }),
      ).rejects.toThrow(SessionNotFoundException);

      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'session-id', userId: 'user-id' },
      });
    });

    it('terminates without ownership check when userId not provided', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.terminateSession('session-id');

      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { id: 'session-id' },
      });
    });
  });

  describe('terminateAllOtherSessions', () => {
    it('deletes all sessions except the current one', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 3 });

      await service.terminateAllOtherSessions('user-id', 'current-id');

      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id', NOT: { id: 'current-id' } },
      });
    });
  });

  describe('terminateAllSessions', () => {
    it('deletes all sessions for the user', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 2 });

      await service.terminateAllSessions('user-id');

      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-id' },
      });
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('deletes expired sessions', async () => {
      mockPrismaService.session.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanupExpiredSessions();

      expect(result.count).toBe(5);
      expect(mockPrismaService.session.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });
  });

  describe('listAllSessions', () => {
    it('returns paginated sessions with user details', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 86_400_000);
      mockPrismaService.session.count.mockResolvedValue(1);
      mockPrismaService.session.findMany.mockResolvedValue([
        {
          id: 'session-1',
          userAgent: 'Chrome',
          ip: '1.2.3.4',
          expiresAt: futureDate,
          createdAt: now,
          updatedAt: now,
          user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        },
      ] as never);

      const result = await service.listAllSessions({}, 1, 25);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toEqual({
        id: 'session-1',
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        userAgent: 'Chrome',
        ip: '1.2.3.4',
        isExpired: false,
        expiresAt: futureDate,
        createdAt: now,
        updatedAt: now,
      });
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 25,
        totalPages: 1,
      });
    });

    it('filters by userId', async () => {
      mockPrismaService.session.count.mockResolvedValue(0);
      mockPrismaService.session.findMany.mockResolvedValue([]);

      await service.listAllSessions({ userId: 'user-1' }, 1, 25);

      expect(mockPrismaService.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });

    it('filters by ip with partial match', async () => {
      mockPrismaService.session.count.mockResolvedValue(0);
      mockPrismaService.session.findMany.mockResolvedValue([]);

      await service.listAllSessions({ ip: '192.168' }, 1, 25);

      expect(mockPrismaService.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            ip: { contains: '192.168', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('filters by userAgent with partial match', async () => {
      mockPrismaService.session.count.mockResolvedValue(0);
      mockPrismaService.session.findMany.mockResolvedValue([]);

      await service.listAllSessions({ userAgent: 'Firefox' }, 1, 25);

      expect(mockPrismaService.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userAgent: { contains: 'Firefox', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('includes expired sessions when includeExpired is true', async () => {
      mockPrismaService.session.count.mockResolvedValue(0);
      mockPrismaService.session.findMany.mockResolvedValue([]);

      await service.listAllSessions({ includeExpired: true }, 1, 25);

      const call = mockPrismaService.session.findMany.mock.calls[0][0];
      expect(call.where).not.toHaveProperty('expiresAt');
    });

    it('excludes expired sessions by default', async () => {
      mockPrismaService.session.count.mockResolvedValue(0);
      mockPrismaService.session.findMany.mockResolvedValue([]);

      await service.listAllSessions({}, 1, 25);

      expect(mockPrismaService.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            expiresAt: { gte: expect.any(Date) },
          }),
        }),
      );
    });

    it('filters by createdAfter', async () => {
      mockPrismaService.session.count.mockResolvedValue(0);
      mockPrismaService.session.findMany.mockResolvedValue([]);

      const dateStr = '2024-06-01T00:00:00.000Z';
      await service.listAllSessions({ createdAfter: dateStr }, 1, 25);

      expect(mockPrismaService.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: new Date(dateStr) },
          }),
        }),
      );
    });

    it('filters by createdBefore', async () => {
      mockPrismaService.session.count.mockResolvedValue(0);
      mockPrismaService.session.findMany.mockResolvedValue([]);

      const dateStr = '2024-12-31T23:59:59.999Z';
      await service.listAllSessions({ createdBefore: dateStr }, 1, 25);

      expect(mockPrismaService.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { lte: new Date(dateStr) },
          }),
        }),
      );
    });

    it('marks expired sessions correctly', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 86_400_000);
      mockPrismaService.session.count.mockResolvedValue(1);
      mockPrismaService.session.findMany.mockResolvedValue([
        {
          id: 'expired-session',
          userAgent: 'Chrome',
          ip: '1.2.3.4',
          expiresAt: pastDate,
          createdAt: now,
          updatedAt: now,
          user: { id: 'user-1', email: 'test@example.com', name: null },
        },
      ] as never);

      const result = await service.listAllSessions({ includeExpired: true }, 1, 25);

      expect(result.data[0].isExpired).toBe(true);
    });
  });

  describe('findSessionById', () => {
    it('returns session with user details', async () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 86_400_000);
      mockPrismaService.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userAgent: 'Chrome',
        ip: '1.2.3.4',
        expiresAt: futureDate,
        createdAt: now,
        updatedAt: now,
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
      });

      const result = await service.findSessionById('session-1');

      expect(result).toEqual({
        id: 'session-1',
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        userAgent: 'Chrome',
        ip: '1.2.3.4',
        isExpired: false,
        expiresAt: futureDate,
        createdAt: now,
        updatedAt: now,
      });
    });

    it('throws SessionNotFoundException when session not found', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(
        service.findSessionById('nonexistent'),
      ).rejects.toThrow(SessionNotFoundException);
    });

    it('marks session as expired when expiresAt is in the past', async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 86_400_000);
      mockPrismaService.session.findUnique.mockResolvedValue({
        id: 'session-1',
        userAgent: 'Chrome',
        ip: '1.2.3.4',
        expiresAt: pastDate,
        createdAt: now,
        updatedAt: now,
        user: { id: 'user-1', email: 'test@example.com', name: null },
      });

      const result = await service.findSessionById('session-1');

      expect(result.isExpired).toBe(true);
    });
  });
});
