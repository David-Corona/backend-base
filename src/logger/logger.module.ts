import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { stdSerializers } from 'pino-http';
import type { Request, Response } from 'express';

export const REDACT_PATHS = [
  'req.body.password',
  'req.body.newPassword',
  'req.body.token',
  'req.cookies.refresh_token',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers.set-cookie',
];

export function parseLogRequestBodies(
  logRequestBodiesRaw: string | undefined,
  isProduction: boolean,
): boolean {
  if (logRequestBodiesRaw === undefined) {
    return !isProduction;
  }
  return logRequestBodiesRaw === 'true';
}

export function buildReqSerializer(
  logRequestBodies: boolean,
): (req: Request) => Record<string, unknown> {
  return (req: Request) => {
    const serialized = stdSerializers.req(
      req,
    );
    // pino-http calls serializers at response-finish time, so req.res.statusCode
    // is always the final response status. This is an implicit dependency on
    // pino-http's internal behavior — if request-start logging is enabled,
    // req.res.statusCode will be undefined and error bodies will be omitted.
    const statusCode = (req as unknown as { res?: { statusCode?: number } }).res
      ?.statusCode;
    const isError = (statusCode ?? 0) >= 400;
    return {
      ...serialized,
      id: (req as unknown as { id?: string }).id,
      body: logRequestBodies || isError ? req.body : undefined,
      query: req.query,
      cookies: req.cookies,
      userId: req.user?.userId,
      roleId: req.user?.roleId,
    };
  };
}

export function buildResSerializer(): (res: Response) => Record<string, unknown> {
  return (res: Response) => {
    const serialized = stdSerializers.res(
      res,
    );
    return {
      ...serialized,
      body: (res as unknown as { locals?: { errorResponseBody?: unknown } }).locals
        ?.errorResponseBody,
    };
  };
}

export function buildGenReqId(): (
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
) => string {
  return (req, res) => {
    const request = req as Request;
    const response = res as Response;
    const id = request.headers['x-request-id']?.toString() ?? randomUUID();
    response.setHeader('X-Request-Id', id);
    return id;
  };
}

// NOTE: pino-http calls customProps at request-start time, before NestJS
// guards populate req.user. At that point userId/roleId are undefined.
// The values are correctly populated in request-finish logs because
// buildReqSerializer (which runs at finish time) also includes them.
// We keep this for any request-scoped logs emitted during handling.
export function buildCustomProps(
  req: import('http').IncomingMessage,
): Record<string, unknown> {
  const request = req as Request;
  return {
    userId: request.user?.userId,
    roleId: request.user?.roleId,
  };
}

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        const logRequestBodiesRaw = configService.get<string>('LOG_REQUEST_BODIES');
        const logRequestBodies = parseLogRequestBodies(
          logRequestBodiesRaw,
          isProduction,
        );
        const logLevel = isProduction ? 'info' : 'debug';

        return {
          pinoHttp: {
            level: logLevel,
            transport: !isProduction
              ? {
                  target: 'pino-pretty',
                  options: { singleLine: true },
                }
              : undefined,
            serializers: {
              req: buildReqSerializer(logRequestBodies),
              res: buildResSerializer(),
            },
            redact: {
              paths: REDACT_PATHS,
              remove: false,
            },
            genReqId: buildGenReqId(),
            customProps: (req: unknown) => buildCustomProps(req as Request),
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class LoggerModule {}
