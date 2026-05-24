import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import type { Server } from 'http';
import { AppModule } from '@/app.module';
import { AppExceptionFilter } from '@/common/filters/app-exception.filter';
import { AuthService } from '@/modules/auth/auth.service';
import { InvalidRefreshTokenException } from '@/modules/auth/auth.exceptions';

interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code: string;
}

describe('Rate Limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mockAuthService = {
      register: jest.fn().mockResolvedValue(undefined),
      refresh: jest.fn().mockImplementation(() => {
        throw new InvalidRefreshTokenException();
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthService)
      .useValue(mockAuthService)
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
  });

  describe('POST /api/auth/register', () => {
    it('allows up to 10 requests then returns 429', async () => {
      const requests: Promise<request.Response>[] = [];

      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app.getHttpServer() as Server)
            .post('/api/auth/register')
            .send({ email: `user${i}@example.com`, password: 'password123' }),
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
        .send({ email: 'blocked@example.com', password: 'password123' });

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
  });

  describe('GET /api/health', () => {
    it('is never rate-limited even when other endpoints are blocked', async () => {
      // Trigger rate limit on auth endpoint
      for (let i = 0; i < 11; i++) {
        await request(app.getHttpServer() as Server)
          .post('/api/auth/register')
          .send({ email: `health${i}@example.com`, password: 'password123' });
      }

      const health = await request(app.getHttpServer() as Server)
        .get('/api/health')
        .expect(200);

      expect(health.body).toEqual({ status: 'ok' });
    });
  });
});
