import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import type { Server } from 'http';
import { Controller, Get } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { AppException } from '@/common/exceptions/app-exception';
import { UserNotFoundException } from '@/common/exceptions/user-exceptions';
import { AppExceptionFilter } from '@/common/filters/app-exception.filter';
import { LoggerModule, Logger } from 'nestjs-pino';

@Controller('test-exceptions')
class TestExceptionsController {
  @Get('app-exception')
  throwAppException(): void {
    throw new AppException(418, 'IM_A_TEAPOT', 'Short and stout');
  }

  @Get('user-not-found')
  throwUserNotFound(): void {
    throw new UserNotFoundException();
  }

  @Get('throttler')
  throwThrottler(): void {
    throw new ThrottlerException();
  }

  @Get('unknown-error')
  throwUnknownError(): void {
    throw new Error('Something went wrong');
  }
}

describe('AppExceptionFilter', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({
          pinoHttp: { level: 'silent' },
        }),
      ],
      controllers: [TestExceptionsController],
    }).compile();

    app = moduleFixture.createNestApplication();
    const logger = await app.resolve(Logger);
    app.useGlobalFilters(new AppExceptionFilter(logger));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('maps AppException to the correct error shape', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/test-exceptions/app-exception')
      .expect(418);

    expect(response.body).toEqual({
      statusCode: 418,
      error: 'Internal Server Error',
      message: 'Short and stout',
      code: 'IM_A_TEAPOT',
    });
  });

  it('maps UserNotFoundException to 404', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/test-exceptions/user-not-found')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'User not found',
      code: 'USER_NOT_FOUND',
    });
  });

  it('maps unknown errors to 500 without leaking details', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/test-exceptions/unknown-error')
      .expect(500);

    expect(response.body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  it('maps ThrottlerException to 429 with RATE_LIMITED code', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/test-exceptions/throttler')
      .expect(429);

    expect(response.body).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Too Many Requests',
      code: 'RATE_LIMITED',
    });
  });
});
