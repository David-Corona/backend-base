import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from 'nestjs-pino';
import { AuthService } from '@/modules/auth/auth.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly authService: AuthService,
    private readonly logger: Logger,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async cleanupExpiredSessions(): Promise<void> {
    this.logger.log('Starting expired session cleanup');
    try {
      const { count } = await this.authService.cleanupExpiredSessions();
      this.logger.log({ deletedCount: count }, 'Expired session cleanup complete');
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Expired session cleanup failed',
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredVerificationTokens(): Promise<void> {
    this.logger.log('Starting expired verification token cleanup');
    try {
      const { count } = await this.authService.cleanupExpiredVerificationTokens();
      this.logger.log({ deletedCount: count }, 'Expired verification token cleanup complete');
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        'Expired verification token cleanup failed',
      );
    }
  }
}
