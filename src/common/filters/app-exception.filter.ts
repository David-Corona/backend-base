import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  BadRequestException as NestBadRequestException,
  UnauthorizedException as NestUnauthorizedException,
  HttpException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Logger } from 'nestjs-pino';
import { AppException } from '../exceptions/app-exception';

const statusLabels: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

function getStatusLabel(statusCode: number): string {
  return statusLabels[statusCode] ?? 'Internal Server Error';
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
      response.status(statusCode).json({
        statusCode,
        error: getStatusLabel(statusCode),
        message,
        code,
      });
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
      response.status(statusCode).json({
        statusCode,
        error: getStatusLabel(statusCode),
        message,
        code: 'VALIDATION_ERROR',
      });
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
      response.status(statusCode).json({
        statusCode,
        error: getStatusLabel(statusCode),
        message,
        code: 'UNAUTHENTICATED',
      });
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
      response.status(statusCode).json({
        statusCode,
        error: getStatusLabel(statusCode),
        message,
        code: 'HTTP_EXCEPTION',
      });
      return;
    }

    const statusCode = HttpStatus.INTERNAL_SERVER_ERROR;

    this.logger.error(
      { err: exception instanceof Error ? exception.message : String(exception) },
      'Unhandled exception',
    );

    response.status(statusCode).json({
      statusCode,
      error: getStatusLabel(statusCode),
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    });
  }
}
