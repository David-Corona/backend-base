import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@/config/config.module';
import { LoggerModule } from '@/logger/logger.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { HealthModule } from '@/modules/health/health.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Module({
  imports: [ConfigModule, LoggerModule, PrismaModule, HealthModule, AuthModule],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
