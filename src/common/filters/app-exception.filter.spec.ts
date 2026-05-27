import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException as NestBadRequestException,
  UnauthorizedException as NestUnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Response, Request } from 'express';
import { Logger } from 'nestjs-pino';
import { AppExceptionFilter } from './app-exception.filter';
import { AppException } from '../exceptions/app-exception';

describe('AppExceptionFilter', () => {
  let filter: AppExceptionFilter;
  let mockResponse: jest.Mocked<Response>;
  let mockRequest: Partial<Request>;
  let mockLogger: { warn: jest.Mock; error: jest.Mock };

  function createMockHost(exception: unknown) {
    const host = {
      switchToHttp: jest.fn().mockReturnThis(),
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn().mockReturnValue(mockRequest),
    };
    host.switchToHttp = jest.fn().mockReturnValue(host);
    return { host, exception };
  }

  function expectErrorResponse(statusCode: number, error: string, message: string, code: string) {
    expect(mockResponse.status).toHaveBeenCalledWith(statusCode);
    expect(mockResponse.json).toHaveBeenCalledWith({ statusCode, error, message, code });
  }

  function expectLocalsBody(statusCode: number, error: string, message: string, code: string) {
    expect(mockResponse.locals.errorResponseBody).toEqual({ statusCode, error, message, code });
  }

  beforeEach(async () => {
    mockLogger = { warn: jest.fn(), error: jest.fn() };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      locals: {},
    } as unknown as jest.Mocked<Response>;
    mockRequest = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppExceptionFilter,
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    filter = module.get(AppExceptionFilter);
  });

  describe('AppException', () => {
    it('returns the exception statusCode, message, and code', () => {
      const exception = new AppException(404, 'USER_NOT_FOUND', 'User not found');
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(404, 'Not Found', 'User not found', 'USER_NOT_FOUND');
      expectLocalsBody(404, 'Not Found', 'User not found', 'USER_NOT_FOUND');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User not found' },
        'Application exception handled',
      );
    });

    it('maps unknown status codes to Unknown Error label', () => {
      const exception = new AppException(418, 'TEAPOT', 'I\'m a teapot');
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(418, 'Unknown Error', 'I\'m a teapot', 'TEAPOT');
    });
  });

  describe('NestBadRequestException', () => {
    it('returns 400 with VALIDATION_ERROR code', () => {
      const exception = new NestBadRequestException('Invalid input');
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(400, 'Bad Request', 'Invalid input', 'VALIDATION_ERROR');
      expectLocalsBody(400, 'Bad Request', 'Invalid input', 'VALIDATION_ERROR');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { statusCode: 400, message: 'Invalid input' },
        'Validation exception handled',
      );
    });

    it('joins array messages with semicolons', () => {
      const exception = new NestBadRequestException(['field1 required', 'field2 required']);
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(400, 'Bad Request', 'field1 required; field2 required', 'VALIDATION_ERROR');
    });

    it('falls back to "Bad Request" for empty message', () => {
      const exception = new NestBadRequestException({ message: undefined });
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(400, 'Bad Request', 'Bad Request', 'VALIDATION_ERROR');
    });
  });

  describe('NestUnauthorizedException', () => {
    it('returns 401 with UNAUTHORIZED code', () => {
      const exception = new NestUnauthorizedException();
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(401, 'Unauthorized', 'Unauthorized', 'UNAUTHORIZED');
      expectLocalsBody(401, 'Unauthorized', 'Unauthorized', 'UNAUTHORIZED');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { statusCode: 401, message: 'Unauthorized' },
        'Unauthorized exception handled',
      );
    });

    it('uses the exception message when provided', () => {
      const exception = new NestUnauthorizedException('Session expired');
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(401, 'Unauthorized', 'Session expired', 'UNAUTHORIZED');
    });
  });

  describe('ThrottlerException', () => {
    it('returns 429 with RATE_LIMITED code', () => {
      const exception = new ThrottlerException();
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(429, 'Too Many Requests', 'Too Many Requests', 'RATE_LIMITED');
      expectLocalsBody(429, 'Too Many Requests', 'Too Many Requests', 'RATE_LIMITED');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { statusCode: 429 },
        'Rate limit exceeded',
      );
    });
  });

  describe('PrismaClientKnownRequestError', () => {
    function createPrismaError(code: string): Prisma.PrismaClientKnownRequestError {
      return new Prisma.PrismaClientKnownRequestError('Database operation failed', {
        code,
        clientVersion: '5.0.0',
      });
    }

    it('maps P2002 to 409 CONFLICT with DATABASE_ERROR code', () => {
      const exception = createPrismaError('P2002');
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(409, 'Conflict', 'Database operation failed', 'DATABASE_ERROR');
      expectLocalsBody(409, 'Conflict', 'Database operation failed', 'DATABASE_ERROR');
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: exception, prismaCode: 'P2002' },
        'Unhandled Prisma error',
      );
    });

    it('maps P2025 to 404 NOT_FOUND', () => {
      const exception = createPrismaError('P2025');
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(404, 'Not Found', 'Database operation failed', 'DATABASE_ERROR');
    });

    it('maps P2003 to 400 BAD_REQUEST', () => {
      const exception = createPrismaError('P2003');
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(400, 'Bad Request', 'Database operation failed', 'DATABASE_ERROR');
    });

    it('maps P2011 to 400 BAD_REQUEST', () => {
      const exception = createPrismaError('P2011');
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(400, 'Bad Request', 'Database operation failed', 'DATABASE_ERROR');
    });

    it('maps unknown Prisma codes to 500', () => {
      const exception = createPrismaError('P9999');
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(500, 'Internal Server Error', 'Database operation failed', 'DATABASE_ERROR');
    });
  });

  describe('generic HttpException', () => {
    it('returns its statusCode and HTTP_EXCEPTION code', () => {
      const exception = new HttpException('Forbidden resource', HttpStatus.FORBIDDEN);
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(403, 'Forbidden', 'Forbidden resource', 'HTTP_EXCEPTION');
      expectLocalsBody(403, 'Forbidden', 'Forbidden resource', 'HTTP_EXCEPTION');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { statusCode: 403, message: 'Forbidden resource' },
        'HTTP exception handled',
      );
    });

    it('extracts message from object response', () => {
      const exception = new HttpException(
        { message: 'Custom message' },
        HttpStatus.BAD_REQUEST,
      );
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(400, 'Bad Request', 'Custom message', 'HTTP_EXCEPTION');
    });
  });

  describe('unknown exceptions', () => {
    it('returns 500 for non-Error values', () => {
      const exception = 'string error';
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(500, 'Internal Server Error', 'Internal server error', 'INTERNAL_SERVER_ERROR');
      expectLocalsBody(500, 'Internal Server Error', 'Internal server error', 'INTERNAL_SERVER_ERROR');
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: 'string error' },
        'Unhandled exception',
      );
    });

    it('returns 500 for Error instances', () => {
      const exception = new Error('Something broke');
      const { host } = createMockHost(exception);

      filter.catch(exception, host as never);

      expectErrorResponse(500, 'Internal Server Error', 'Internal server error', 'INTERNAL_SERVER_ERROR');
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: exception },
        'Unhandled exception',
      );
    });
  });
});
