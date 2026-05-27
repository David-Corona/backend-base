import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  BadRequestException as NestBadRequestException,
  UnauthorizedException as NestUnauthorizedException,
  HttpException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { Logger } from 'nestjs-pino';
import { AppException } from '../exceptions/app-exception';

const statusLabels: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too Many Requests',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

function mapPrismaErrorToStatus(code: string): number {
  switch (code) {
    case 'P2002': return HttpStatus.CONFLICT;
    case 'P2025': return HttpStatus.NOT_FOUND;
    case 'P2003': return HttpStatus.BAD_REQUEST;
    case 'P2011': return HttpStatus.BAD_REQUEST;
    default: return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

function getStatusLabel(statusCode: number): string {
  return statusLabels[statusCode] ?? 'Unknown Error';
}

function extractMessage(response: string | { message?: string | string[] }): string {
  if (typeof response === 'string') {
    return response;
  }
  if (Array.isArray(response.message)) {
    return response.message.join('; ');
  }
  return response.message ?? 'Bad Request';
}

function sendErrorResponse(
  response: Response,
  statusCode: number,
  message: string,
  code: string,
): void {
  const body = {
    statusCode,
    error: getStatusLabel(statusCode),
    message,
    code,
  };
  response.locals.errorResponseBody = body;
  response.status(statusCode).json(body);
}

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof AppException) {
      const { statusCode, code, message } = exception;
      this.logger.warn(
        { statusCode, code, message },
        'Application exception handled',
      );
      sendErrorResponse(response, statusCode, message, code);
      return;
    }

    if (exception instanceof NestBadRequestException) {
      const statusCode = exception.getStatus();
      const responseBody = exception.getResponse();
      const message = extractMessage(responseBody);
      this.logger.warn(
        { statusCode, message },
        'Validation exception handled',
      );
      sendErrorResponse(response, statusCode, message, 'VALIDATION_ERROR');
      return;
    }

    if (exception instanceof NestUnauthorizedException) {
      const statusCode = exception.getStatus();
      const responseBody = exception.getResponse();
      const message = typeof responseBody === 'string'
        ? responseBody
        : extractMessage(responseBody);
      this.logger.warn(
        { statusCode, message },
        'Unauthorized exception handled',
      );
      sendErrorResponse(response, statusCode, message, 'UNAUTHORIZED');
      return;
    }

    if (exception instanceof ThrottlerException) {
      const statusCode = exception.getStatus();
      this.logger.warn(
        { statusCode },
        'Rate limit exceeded',
      );
      sendErrorResponse(response, statusCode, 'Too Many Requests', 'RATE_LIMITED');
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const statusCode = mapPrismaErrorToStatus(exception.code);
      const message = 'Database operation failed';
      this.logger.error(
        { err: exception, prismaCode: exception.code },
        'Unhandled Prisma error',
      );
      sendErrorResponse(response, statusCode, message, 'DATABASE_ERROR');
      return;
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const responseBody = exception.getResponse();
      const message = typeof responseBody === 'string'
        ? responseBody
        : extractMessage(responseBody);
      this.logger.warn(
        { statusCode, message },
        'HTTP exception handled',
      );
      sendErrorResponse(response, statusCode, message, 'HTTP_EXCEPTION');
      return;
    }

    const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.error(
      { err: exception instanceof Error ? exception : String(exception) },
      'Unhandled exception',
    );
    sendErrorResponse(
      response,
      statusCode,
      'Internal server error',
      'INTERNAL_SERVER_ERROR',
    );
  }
}
