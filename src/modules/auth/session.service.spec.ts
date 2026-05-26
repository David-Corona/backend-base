import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SessionService } from './session.service';
import {
  SessionNotFoundException,
  CannotTerminateCurrentSessionException,
} from './auth.exceptions';

describe('SessionService', () => {
  let service: SessionService;

  const mockPrismaService = {
    session: {
      create: jest.fn(),
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

  describe('listSessions', () => {
    it('returns all non-expired sessions, marking the current one', async () => {
      const now = new Date();
      mockPrismaService.session.findMany.mockResolvedValue([
        {
          id: 'session-1',
          userAgent: 'Chrome',
          ip: '1.2.3.4',
          expiresAt: new Date(now.getTime() + 86_400_000),
          createdAt: now,
        },
        {
          id: 'session-2',
          userAgent: null,
          ip: null,
          expiresAt: new Date(now.getTime() + 86_400_000),
          createdAt: new Date(now.getTime() - 1000),
        },
      ] as never);

      const result = await service.listSessions('user-id', 'session-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'session-1',
        isCurrent: true,
        userAgent: 'Chrome',
        ip: '1.2.3.4',
        expiresAt: expect.any(Date),
        createdAt: now,
      });
      expect(result[1]).toEqual({
        id: 'session-2',
        isCurrent: false,
        userAgent: null,
        ip: null,
        expiresAt: expect.any(Date),
        createdAt: expect.any(Date),
      });
      expect(mockPrismaService.session.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-id', expiresAt: { gte: expect.any(Date) } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          userAgent: true,
          ip: true,
          expiresAt: true,
          createdAt: true,
        },
      });
    });

    it('returns empty array when user has no sessions', async () => {
      mockPrismaService.session.findMany.mockResolvedValue([]);

      const result = await service.listSessions('user-id');

      expect(result).toEqual([]);
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
});
