import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { Logger } from 'nestjs-pino';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: Logger,
  ) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error : String(error) },
        'Database health check failed',
      );
      return this.getStatus(key, false, { error: 'Database connection failed' });
    }
  }
}
