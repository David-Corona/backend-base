import { Module, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { IncomingMessage, ServerResponse } from 'http';

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-forwarded-for"]',
  'req.cookies.refresh_token',
  'req.body.password',
  'req.body.newPassword',
  'req.body.currentPassword',
  'req.body.token',
  'req.body.access_token',
  'req.body.refresh_token',
  'req.body.secret',
  'req.body.email',
  'req.body.phone',
  'req.body.ssn',
  'req.body.creditCard',
  'res.headers.set-cookie',
];

const RESPONSE_HEADERS_ALLOWLIST = new Set([
  'content-type',
  'content-length',
  'etag',
  'x-request-id',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
]);

export function buildResSerializer(): (res: Record<string, unknown>) => Record<string, unknown> {
  return (res: Record<string, unknown>) => {
    const headers = (res.headers ?? {}) as Record<string, unknown>;
    const trimmedHeaders: Record<string, unknown> = {};
    for (const key of Object.keys(headers)) {
      if (RESPONSE_HEADERS_ALLOWLIST.has(key)) {
        trimmedHeaders[key] = headers[key];
      }
    }
    return {
      statusCode: res.statusCode,
      headers: trimmedHeaders,
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
  logRequestBodies: boolean,
  logResponseBodies: boolean,
): Record<string, unknown> {
  const expressReq = req as Request;
  const expressRes = res as Response;
  const user = expressReq.user as { userId?: string; roleId?: string } | undefined;
  const props: Record<string, unknown> = {
    userId: user?.userId,
    roleId: user?.roleId,
    userAgent: expressReq.headers['user-agent'],
  };

  if (logRequestBodies && expressReq.body && typeof expressReq.body === 'object' && Object.keys(expressReq.body).length > 0) {
    props.requestBody = expressReq.body;
  }

  if (logResponseBodies) {
    if (expressRes.locals?.responseBody !== undefined) {
      props.responseBody = expressRes.locals.responseBody;
    } else if (expressRes.locals?.errorResponseBody !== undefined) {
      props.responseBody = expressRes.locals.errorResponseBody;
    }
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
        const logRequestBodies = configService.get('LOG_REQUEST_BODIES') === 'true';
        const logResponseBodies = configService.get('LOG_RESPONSE_BODIES') === 'true';

        return {
          pinoHttp: {
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
            serializers: {
              res: buildResSerializer(),
            },
            redact: {
              paths: REDACT_PATHS,
              remove: true,
            },
            genReqId: buildGenReqId(),
            customProps: (req: unknown, res: unknown) =>
              buildCustomProps(req as Request, res as Response, logRequestBodies, logResponseBodies),
            autoLogging: {
              ignore: (req: IncomingMessage) => {
                const expressReq = req as Request;
                const ignorePaths = ['/health', '/api/health', '/health/liveness', '/health/readiness', '/metrics'];
                return ignorePaths.includes(expressReq.path);
              },
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
