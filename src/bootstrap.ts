import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Express } from 'express';
import { AppExceptionFilter } from '@/common/filters/app-exception.filter';

export function configureApp(app: INestApplication, configService: ConfigService): void {
  app.useLogger(app.get(Logger));
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  app.useGlobalFilters(new AppExceptionFilter(app.get(Logger)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.use(cookieParser());
  app.use(helmet());

  const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS');
  if (allowedOrigins) {
    app.enableCors({
      origin: allowedOrigins.split(',').map((o) => o.trim()).filter(Boolean),
      credentials: true,
    });
  }

  app.setGlobalPrefix('api');

  const trustProxy = configService.get<number>('TRUST_PROXY');
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.set('trust proxy', trustProxy);
}
