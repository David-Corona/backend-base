import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { SessionResponseDto } from '@/common/dto/session-response.dto';
import {
  SessionNotFoundException,
  CannotTerminateCurrentSessionException,
} from './auth.exceptions';

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

  async listSessions(userId: string, currentSessionId?: string): Promise<SessionResponseDto[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, expiresAt: { gte: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ip: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      isCurrent: session.id === currentSessionId,
      userAgent: session.userAgent,
      ip: session.ip,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    }));
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
