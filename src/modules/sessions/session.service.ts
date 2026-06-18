import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { paginate } from '@/common/utils/pagination';
import { SessionResponseDto } from '@/common/dto/session-response.dto';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import type { AdminSessionResponseDto } from './dto/admin-session-response.dto';
import {
  SessionNotFoundException,
  CannotTerminateCurrentSessionException,
} from './sessions.exceptions';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string | null;
    ip?: string | null;
  }): Promise<{ id: string }> {
    return this.prisma.session.create({
      data,
      select: { id: true },
    });
  }

  async createInTransaction(
    tx: TransactionClient,
    data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      userAgent?: string | null;
      ip?: string | null;
    },
  ): Promise<{ id: string }> {
    return tx.session.create({
      data,
      select: { id: true },
    });
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<{ id: string; userId: string; expiresAt: Date; userAgent: string | null; ip: string | null } | null> {
    return this.prisma.session.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, userAgent: true, ip: true },
    });
  }

  async consumeSessionByTokenHashInTransaction(
    tx: TransactionClient,
    tokenHash: string,
  ): Promise<{ id: string; userId: string; expiresAt: Date; userAgent: string | null; ip: string | null }> {
    return tx.session.delete({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, userAgent: true, ip: true },
    });
  }

  async deleteByUserIdInTransaction(
    tx: TransactionClient,
    userId: string,
  ): Promise<void> {
    await tx.session.deleteMany({ where: { userId } });
  }

  async findDeviceSessionInTransaction(
    tx: TransactionClient,
    userId: string,
    userAgent: string | null | undefined,
    ip: string | null | undefined,
  ): Promise<{ id: string } | null> {
    const session = await tx.session.findFirst({
      where: {
        userId,
        userAgent: userAgent ?? null,
        ip: ip ?? null,
        expiresAt: { gte: new Date() },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    return session;
  }

  async deleteByIdInTransaction(
    tx: TransactionClient,
    id: string,
  ): Promise<void> {
    await tx.session.deleteMany({ where: { id } });
  }

  async deleteOldestUserSessionsInTransaction(
    tx: TransactionClient,
    userId: string,
    keepCount: number,
  ): Promise<void> {
    const sessions = await tx.session.findMany({
      where: {
        userId,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
      skip: keepCount,
    });

    if (sessions.length > 0) {
      const ids = sessions.map((s) => s.id);
      await tx.session.deleteMany({
        where: { id: { in: ids } },
      });
    }
  }

  async findDeviceSession(
    userId: string,
    userAgent: string | null | undefined,
    ip: string | null | undefined,
  ): Promise<{ id: string } | null> {
    const session = await this.prisma.session.findFirst({
      where: {
        userId,
        userAgent: userAgent ?? null,
        ip: ip ?? null,
        expiresAt: { gte: new Date() },
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
    return session;
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id } });
  }

  async deleteOldestUserSessions(userId: string, keepCount: number): Promise<void> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
      skip: keepCount,
    });

    if (sessions.length > 0) {
      const ids = sessions.map((s) => s.id);
      await this.prisma.session.deleteMany({
        where: { id: { in: ids } },
      });
    }
  }

  async listSessions(
    userId: string,
    currentSessionId?: string,
    page: number = 1,
    limit: number = 25,
  ): Promise<PaginatedResponse<SessionResponseDto>> {
    const where = { userId, expiresAt: { gte: new Date() } };

    const result = await paginate(
      () => this.prisma.session.count({ where }),
      (skip, take) =>
        this.prisma.session.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            userAgent: true,
            ip: true,
            expiresAt: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
      page,
      limit,
    );

    return {
      data: result.data.map((session) => ({
        id: session.id,
        isCurrent: session.id === currentSessionId,
        userAgent: session.userAgent,
        ip: session.ip,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })),
      meta: result.meta,
    };
  }

  async listAllSessions(
    filters: {
      userId?: string;
      ip?: string;
      userAgent?: string;
      includeExpired?: boolean;
      createdAfter?: string;
      createdBefore?: string;
    },
    page: number = 1,
    limit: number = 25,
  ): Promise<PaginatedResponse<AdminSessionResponseDto>> {
    const where: Prisma.SessionWhereInput = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (!filters.includeExpired) {
      where.expiresAt = { gte: new Date() };
    }

    if (filters.ip) {
      where.ip = { contains: filters.ip, mode: 'insensitive' };
    }

    if (filters.userAgent) {
      where.userAgent = { contains: filters.userAgent, mode: 'insensitive' };
    }

    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) {
        where.createdAt.gte = new Date(filters.createdAfter);
      }
      if (filters.createdBefore) {
        where.createdAt.lte = new Date(filters.createdBefore);
      }
    }

    const result = await paginate(
      () => this.prisma.session.count({ where }),
      (skip, take) =>
        this.prisma.session.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            userAgent: true,
            ip: true,
            expiresAt: true,
            createdAt: true,
            updatedAt: true,
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        }),
      page,
      limit,
    );

    const now = new Date();
    return {
      data: result.data.map((session) => ({
        id: session.id,
        user: session.user,
        userAgent: session.userAgent,
        ip: session.ip,
        isExpired: session.expiresAt < now,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })),
      meta: result.meta,
    };
  }

  async findSessionById(sessionId: string): Promise<AdminSessionResponseDto> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userAgent: true,
        ip: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!session) {
      throw new SessionNotFoundException();
    }

    const now = new Date();
    return {
      id: session.id,
      user: session.user,
      userAgent: session.userAgent,
      ip: session.ip,
      isExpired: session.expiresAt < now,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  async terminateSession(
    sessionId: string,
    options?: { userId?: string; currentSessionId?: string },
  ): Promise<void> {
    if (options?.currentSessionId && options.currentSessionId === sessionId) {
      throw new CannotTerminateCurrentSessionException();
    }

    const where: Prisma.SessionWhereInput = { id: sessionId };
    if (options?.userId) where.userId = options.userId;

    const result = await this.prisma.session.deleteMany({ where });

    if (result.count === 0) {
      throw new SessionNotFoundException();
    }
  }

  async terminateAllOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        userId,
        NOT: { id: currentSessionId },
      },
    });
  }

  async terminateAllSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  async cleanupExpiredSessions(): Promise<{ count: number }> {
    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return { count: result.count };
  }
}
