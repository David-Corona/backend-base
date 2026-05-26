import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import type { Server } from 'http';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import { AppModule } from '@/app.module';
import { AppExceptionFilter } from '@/common/filters/app-exception.filter';
import { PrismaHealthIndicator } from '@/modules/health/prisma-health-indicator';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mockPrismaHealth = {
      pingCheck: jest.fn().mockResolvedValue({
        database: { status: 'up' },
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
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
  });

  it('/api/health (GET) returns Terminus health check format', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
    expect(response.body).toHaveProperty('info');
    expect(response.body).toHaveProperty('error');
    expect(response.body).toHaveProperty('details');
    expect(response.body.info).toHaveProperty('database');
    expect(response.body.info.database).toHaveProperty('status', 'up');
  });
});
