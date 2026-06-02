import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Express } from 'express';
import { AppExceptionFilter } from '@/common/filters/app-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as crypto from 'crypto';

export function configureApp(app: INestApplication, configService: ConfigService): void {
  const logger = app.get(Logger);

  app.useLogger(logger);
  app.useGlobalInterceptors(new LoggerErrorInterceptor());
  app.useGlobalFilters(new AppExceptionFilter(logger));
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
  } else {
    logger.warn('ALLOWED_ORIGINS is not set. CORS is disabled.');
  }

  app.setGlobalPrefix('api');

  const trustProxy = configService.get<number>('TRUST_PROXY');
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.set('trust proxy', trustProxy);

  setupSwagger(app, configService, logger);
}

function setupSwagger(app: INestApplication, configService: ConfigService, logger: Logger): void {
  const adminUser = configService.get<string>('ADMIN_USER')!;
  const adminPassword = configService.get<string>('ADMIN_PASSWORD')!;
  const expectedUserBuf = Buffer.from(adminUser);
  const expectedPassBuf = Buffer.from(adminPassword);
  const expressApp = app.getHttpAdapter().getInstance() as Express;

  expressApp.use('/docs', (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Basic ')) {
      res.set('WWW-Authenticate', 'Basic realm="Swagger"');
      return res.status(401).json({ statusCode: 401, error: 'Unauthorized', message: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const colonIdx = decoded.indexOf(':');
    const user = colonIdx === -1 ? '' : decoded.slice(0, colonIdx);
    const pass = colonIdx === -1 ? '' : decoded.slice(colonIdx + 1);
    const userBuf = Buffer.from(user);
    const passBuf = Buffer.from(pass);

    if (
      userBuf.length !== expectedUserBuf.length ||
      passBuf.length !== expectedPassBuf.length ||
      !crypto.timingSafeEqual(userBuf, expectedUserBuf) ||
      !crypto.timingSafeEqual(passBuf, expectedPassBuf)
    ) {
      logger.warn({ ip: req.ip }, 'Swagger auth failed');
      res.set('WWW-Authenticate', 'Basic realm="Swagger"');
      return res.status(401).json({ statusCode: 401, error: 'Unauthorized', message: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    return next();
  });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('API')
      .setDescription('Backend API for user management, authentication, and role-based access control.')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'API Docs',
  });
}
