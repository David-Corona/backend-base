import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { IncomingMessage, ServerResponse } from 'http';

export const REDACT_PATHS = [
  'request.headers.authorization',
  'request.headers.cookie',
  'request.headers["x-api-key"]',
  'request.cookies.refresh_token',
  'requestBody.password',
  'requestBody.access_token',
  'requestBody.refresh_token',
  'requestBody.token',
  'requestBody.secret',
  'requestBody.currentPassword',
  'requestBody.newPassword',
  'responseBody.access_token',
  'responseBody.refresh_token',
  'responseBody.token',
  'response.headers.set-cookie',
];

export function buildReqSerializer(): (req: Request) => Record<string, unknown> {
  return (req: Request) => {
    return {
      id: req.id,
      method: req.method,
      url: req.url,
      path: req.path,
      params: req.params,
      query: req.query,
      cookies: req.cookies,
      remoteAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    };
  };
}

export function buildResSerializer(): (res: Response) => Record<string, unknown> {
  return (res: Response) => {
    return {
      statusCode: res.statusCode,
      contentLength: (res as any).headers?.['content-length'],
    };
  };
}

export function buildGenReqId(): (req: IncomingMessage, res: ServerResponse) => string {
  return (req, res) => {
    const expressReq = req as Request;
    const expressRes = res as Response;
    const id = (expressReq.id || (expressReq.headers['x-request-id'] as string) || randomUUID()) as string;
    expressRes.setHeader('X-Request-Id', id);
    return id;
  };
}

export function buildCustomProps(
  req: IncomingMessage,
  res: ServerResponse,
): Record<string, unknown> {
  const expressReq = req as Request;
  const expressRes = res as Response;
  const props: Record<string, unknown> = {
    userId: expressReq.user?.userId,
    roleId: expressReq.user?.roleId,
  };

  if (expressReq.body && typeof expressReq.body === 'object' && Object.keys(expressReq.body).length > 0) {
    props.requestBody = expressReq.body;
  }

  if (expressRes.locals?.errorResponseBody !== undefined) {
    props.responseBody = expressRes.locals.errorResponseBody;
  }

  return props;
}

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        const logLevel = isProduction ? 'info' : 'debug';

        return {
          pinoHttp: {
            messageKey: 'message',
            level: logLevel,
            transport: !isProduction
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'HH:MM:ss.l',
                    ignore: 'pid,hostname',
                    singleLine: false,
                  },
                }
              : undefined,
            wrapSerializers: false,
            serializers: {
              req: buildReqSerializer(),
              res: buildResSerializer(),
            },
            redact: {
              paths: REDACT_PATHS,
              remove: true,
            },
            genReqId: buildGenReqId(),
            customProps: (req: unknown, res: unknown) => buildCustomProps(req as Request, res as Response),
            autoLogging: {
              ignore: (req: IncomingMessage) => {
                const expressReq = req as Request;
                const ignorePaths = ['/health', '/api/health', '/health/liveness', '/health/readiness', '/metrics'];
                return ignorePaths.includes(expressReq.path);
              },
            },
            customReceivedObject: () => {
              return { level: 'trace' };
            },
            customSuccessMessage: (req: IncomingMessage, res: ServerResponse) => {
              const expressReq = req as Request;
              return `[${expressReq.id}] ${expressReq.method} ${expressReq.path} ${res.statusCode}`;
            },
            customErrorMessage: (req: IncomingMessage, res: ServerResponse, err: Error) => {
              const expressReq = req as Request;
              return `[${expressReq.id}] ${expressReq.method} ${expressReq.path} ${res.statusCode} - ${err.message}`;
            },
            customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
              if (res.statusCode >= 500 || err) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
            customAttributeKeys: {
              req: 'request',
              res: 'response',
              err: 'error',
              responseTime: 'duration',
            },
          },
          forRoutes: [{ path: '{*splat}', method: RequestMethod.ALL }],
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class LoggerModule {}
