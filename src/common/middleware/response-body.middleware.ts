import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class ResponseBodyMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalEnd = res.end.bind(res);

    res.json = (body: unknown) => {
      res.locals.responseBody = body;
      return originalJson(body);
    };

    res.send = (body: unknown) => {
      res.locals.responseBody = body;
      return originalSend(body);
    };

    res.end = (chunk?: unknown, encoding?: unknown) => {
      if (chunk !== undefined && res.locals.responseBody === undefined) {
        res.locals.responseBody = chunk;
      }
      return originalEnd(chunk, encoding as BufferEncoding);
    };

    next();
  }
}
