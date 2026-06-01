import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Express, RequestHandler, Response } from 'express';
import { AppExceptionFilter } from '@/common/filters/app-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as crypto from 'crypto';

const SWAGGER_PATH = 'docs';
const SWAGGER_MAX_ATTEMPTS = 10;
const SWAGGER_RATE_LIMIT_WINDOW_MS = 60_000;

function sendJsonError(
  res: Response,
  statusCode: number,
  error: string,
  message: string,
  code: string,
): void {
  res.status(statusCode).json({ statusCode, error, message, code });
}

function createSwaggerBasicAuth(expectedUser: string, expectedPassword: string, logger: Logger): RequestHandler {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  const expectedUserBuf = Buffer.from(expectedUser);
  const expectedPassBuf = Buffer.from(expectedPassword);

  const isLocked = (ip: string, now: number): boolean => {
    const entry = attempts.get(ip);
    if (!entry) return false;
    if (now >= entry.resetAt) {
      attempts.delete(ip);
      return false;
    }
    return entry.count >= SWAGGER_MAX_ATTEMPTS;
  };

  const recordFailure = (ip: string, now: number): number => {
    const entry = attempts.get(ip);
    const count = (entry && now < entry.resetAt ? entry.count : 0) + 1;
    attempts.set(ip, { count, resetAt: now + SWAGGER_RATE_LIMIT_WINDOW_MS });
    return count;
  };

  return (req, res, next) => {
    const ip = req.ip ?? 'unknown';
    const now = Date.now();

    if (isLocked(ip, now)) {
      logger.warn({ ip, path: req.originalUrl }, 'Swagger auth rate limit exceeded');
      const entry = attempts.get(ip)!;
      res.set('Retry-After', Math.ceil((entry.resetAt - now) / 1000).toString());
      return sendJsonError(res, 429, 'Too Many Requests', 'Too many failed attempts. Try again later.', 'RATE_LIMITED');
    }

    const authHeader = req.headers['authorization'];
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Basic ')) {
      recordFailure(ip, now);
      logger.warn({ ip, path: req.originalUrl }, 'Swagger auth failed: missing or malformed header');
      res.set('WWW-Authenticate', 'Basic realm="Swagger"');
      return sendJsonError(res, 401, 'Unauthorized', 'Authentication required', 'AUTH_REQUIRED');
    }

    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const colonIdx = decoded.indexOf(':');
    const user = colonIdx === -1 ? '' : decoded.slice(0, colonIdx);
    const pass = colonIdx === -1 ? '' : decoded.slice(colonIdx + 1);
    const userBuf = Buffer.from(user);
    const passBuf = Buffer.from(pass);

    const valid =
      userBuf.length === expectedUserBuf.length &&
      passBuf.length === expectedPassBuf.length &&
      crypto.timingSafeEqual(userBuf, expectedUserBuf) &&
      crypto.timingSafeEqual(passBuf, expectedPassBuf);

    if (!valid) {
      recordFailure(ip, now);
      logger.warn({ ip, path: req.originalUrl }, 'Swagger auth failed: invalid credentials');
      res.set('WWW-Authenticate', 'Basic realm="Swagger"');
      return sendJsonError(res, 401, 'Unauthorized', 'Authentication required', 'AUTH_REQUIRED');
    }

    attempts.delete(ip);
    return next();
  };
}

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

  app.setGlobalPrefix('api', { exclude: [SWAGGER_PATH] });

  const trustProxy = configService.get<number>('TRUST_PROXY');
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.set('trust proxy', trustProxy);

  const adminUser = configService.get<string>('ADMIN_USER')!;
  const adminPassword = configService.get<string>('ADMIN_PASSWORD')!;

  expressApp.use(`/${SWAGGER_PATH}`, createSwaggerBasicAuth(adminUser, adminPassword, logger));

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('API')
      .setDescription('')
      .setVersion('1')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'API Docs',
  });
}
