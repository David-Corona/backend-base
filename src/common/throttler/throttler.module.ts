import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: configService.getOrThrow<number>('RATE_LIMIT_TTL'),
            limit: configService.getOrThrow<number>('RATE_LIMIT_DEFAULT'),
          },
        ],
      }),
    }),
  ],
})
export class ThrottlerConfigModule {}
