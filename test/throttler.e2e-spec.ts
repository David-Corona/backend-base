import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import type { Server } from 'http';
import { AppExceptionFilter } from '@/common/filters/app-exception.filter';
import { AuthService } from '@/modules/auth/auth.service';
import { InvalidRefreshTokenException } from '@/modules/auth/auth.exceptions';
import { PrismaHealthIndicator } from '@/modules/health/prisma-health-indicator';

interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code: string;
}

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;
  const origAuthRateLimit = process.env.RATE_LIMIT_AUTH;
  const origDefaultRateLimit = process.env.RATE_LIMIT_DEFAULT;
  const origRateLimitTtl = process.env.RATE_LIMIT_TTL;

  beforeAll(async () => {
    process.env.RATE_LIMIT_AUTH = '10';
    process.env.RATE_LIMIT_DEFAULT = '60';
    process.env.RATE_LIMIT_TTL = '60000';

    const { AppModule } = await import('@/app.module');

    const mockAuthService = {
      register: jest.fn().mockResolvedValue(undefined),
      refresh: jest.fn().mockImplementation(() => {
        throw new InvalidRefreshTokenException();
      }),
    };

    const mockPrismaHealth = {
      pingCheck: jest.fn().mockResolvedValue({
        database: { status: 'up' },
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(mockAuthService)
      .overrideProvider(PrismaHealthIndicator)
      .useValue(mockPrismaHealth)
      .compile();

    app = moduleFixture.createNestApplication();
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
    app.enableCors();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (origAuthRateLimit !== undefined) { process.env.RATE_LIMIT_AUTH = origAuthRateLimit; } else { delete process.env.RATE_LIMIT_AUTH; }
    if (origDefaultRateLimit !== undefined) { process.env.RATE_LIMIT_DEFAULT = origDefaultRateLimit; } else { delete process.env.RATE_LIMIT_DEFAULT; }
    if (origRateLimitTtl !== undefined) { process.env.RATE_LIMIT_TTL = origRateLimitTtl; } else { delete process.env.RATE_LIMIT_TTL; }
  });

  describe('POST /api/auth/register', () => {
    it('allows up to 10 requests then returns 429', async () => {
      const requests: Promise<request.Response>[] = [];

      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app.getHttpServer() as Server)
            .post('/api/auth/register')
            .send({ email: `user${i}@example.com`, password: 'Password123' }),
        );
      }

      const responses = await Promise.all(requests);
      responses.forEach((res) => {
        expect(res.status).toBe(201);
        expect(res.body).toEqual({
          message: 'Registration successful. Please verify your email.',
        });
      });

      const blocked = await request(app.getHttpServer() as Server)
        .post('/api/auth/register')
        .send({ email: 'blocked@example.com', password: 'Password123' });

      expect(blocked.status).toBe(429);
      const body = blocked.body as ApiErrorResponse;
      expect(body.statusCode).toBe(429);
      expect(body.error).toBe('Too Many Requests');
      expect(body.code).toBe('RATE_LIMITED');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('is not rate-limited at low volume', async () => {
      const requests: Promise<request.Response>[] = [];

      for (let i = 0; i < 3; i++) {
        requests.push(
          request(app.getHttpServer() as Server).post('/api/auth/refresh'),
        );
      }

      const responses = await Promise.all(requests);
      responses.forEach((res) => {
        expect(res.status).toBe(401);
        expect(res.body).toEqual({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid or expired refresh token',
          code: 'INVALID_REFRESH_TOKEN',
        });
      });
    });

    it('uses the global rate limit (60), not the auth-specific limit (10)', async () => {
      const requests: Promise<request.Response>[] = [];

      for (let i = 0; i < 15; i++) {
        requests.push(
          request(app.getHttpServer() as Server).post('/api/auth/refresh'),
        );
      }

      const responses = await Promise.all(requests);
      responses.forEach((res) => {
        expect(res.status).toBe(401);
      });
    });
  });

  describe('GET /api/health', () => {
    it('is never rate-limited even when other endpoints are blocked', async () => {
      // Trigger rate limit on auth endpoint
      for (let i = 0; i < 11; i++) {
        await request(app.getHttpServer() as Server)
          .post('/api/auth/register')
          .send({ email: `health${i}@example.com`, password: 'Password123' });
      }

      const health = await request(app.getHttpServer() as Server)
        .get('/api/health')
        .expect(200);

      expect(health.body).toHaveProperty('status', 'ok');
      expect(health.body).toHaveProperty('info');
      expect(health.body).toHaveProperty('error');
      expect(health.body).toHaveProperty('details');
    });
  });
});
