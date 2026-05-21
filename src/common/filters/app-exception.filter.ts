import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { PinoLogger } from 'nestjs-pino';
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

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

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
