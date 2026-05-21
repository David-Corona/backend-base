import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { envSchema } from './env';
import type { ZodIssue } from 'zod';

@Module({
  imports: [
    NestConfigModule.forRoot({
      validate: (config: Record<string, unknown>) => {
        const parsed = envSchema.safeParse(config);
        if (!parsed.success) {
          throw new Error(
            `Environment validation failed: ${parsed.error.issues.map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
          );
        }
        return parsed.data;
      },
      isGlobal: true,
    }),
  ],
})
export class ConfigModule {}
