import {
  buildReqSerializer,
  buildResSerializer,
  buildGenReqId,
  buildCustomProps,
  parseLogRequestBodies,
  REDACT_PATHS,
} from './logger.module';
import { stdSerializers } from 'pino-http';

describe('buildReqSerializer', () => {
  const baseReq = {
    method: 'POST',
    url: '/api/auth/login',
    headers: {},
    query: { foo: 'bar' },
    body: { email: 'test@example.com', password: 'secret123' },
    cookies: { refresh_token: 'abc123' },
    user: { userId: 'user-1', roleId: 'role-1' },
    id: 'req-id-123',
    res: { statusCode: 200 },
  };

  it('includes body when logRequestBodies is true', () => {
    const serializer = buildReqSerializer(true);
    const result = serializer(baseReq as any);

    expect(result.body).toEqual(baseReq.body);
    expect(result.query).toEqual(baseReq.query);
    expect(result.cookies).toEqual(baseReq.cookies);
    expect(result.userId).toBe('user-1');
    expect(result.roleId).toBe('role-1');
    expect(result.id).toBe('req-id-123');
    expect(result.method).toBe('POST');
    expect(result.url).toBe('/api/auth/login');
  });

  it('omits body on success when logRequestBodies is false', () => {
    const serializer = buildReqSerializer(false);
    const result = serializer(baseReq as any);

    expect(result.body).toBeUndefined();
    expect(result.query).toEqual(baseReq.query);
    expect(result.cookies).toEqual(baseReq.cookies);
    expect(result.userId).toBe('user-1');
    expect(result.roleId).toBe('role-1');
    expect(result.id).toBe('req-id-123');
  });

  it('includes body on error responses even when logRequestBodies is false', () => {
    const serializer = buildReqSerializer(false);
    const errorReq = { ...baseReq, res: { statusCode: 400 } };
    const result = serializer(errorReq as any);

    expect(result.body).toEqual(baseReq.body);
    expect(result.id).toBe('req-id-123');
  });

  it('handles requests without user (public routes)', () => {
    const serializer = buildReqSerializer(true);
    const reqWithoutUser = { ...baseReq, user: undefined };
    const result = serializer(reqWithoutUser as any);

    expect(result.userId).toBeUndefined();
    expect(result.roleId).toBeUndefined();
    expect(result.body).toEqual(baseReq.body);
    expect(result.id).toBe('req-id-123');
  });

  it('handles requests without body', () => {
    const serializer = buildReqSerializer(true);
    const reqWithoutBody = { ...baseReq, body: undefined };
    const result = serializer(reqWithoutBody as any);

    expect(result.body).toBeUndefined();
  });
});

describe('buildResSerializer', () => {
  beforeEach(() => {
    jest.spyOn(stdSerializers, 'res').mockImplementation((res: any) => ({
      statusCode: res.statusCode,
      headers: {},
      raw: res,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('includes errorResponseBody from res.locals when present', () => {
    const serializer = buildResSerializer();
    const res = {
      statusCode: 400,
      locals: {
        errorResponseBody: {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid token',
          code: 'INVALID_TOKEN',
        },
      },
    };
    const result = serializer(res as any);

    expect(result.statusCode).toBe(400);
    expect(result.body).toEqual(res.locals.errorResponseBody);
  });

  it('omits body when errorResponseBody is not present', () => {
    const serializer = buildResSerializer();
    const res = { statusCode: 200 };
    const result = serializer(res as any);

    expect(result.statusCode).toBe(200);
    expect(result.body).toBeUndefined();
  });
});

describe('buildGenReqId', () => {
  it('always generates a new UUID regardless of incoming header', () => {
    const genReqId = buildGenReqId();
    const req = {
      headers: { 'x-request-id': 'existing-id-123' },
    } as any;
    const res = { setHeader: jest.fn() } as any;

    const id = genReqId(req, res);

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', id);
  });

  it('generates a UUID on every call', () => {
    const genReqId = buildGenReqId();
    const req = { headers: {} } as any;
    const res = { setHeader: jest.fn() } as any;

    const id = genReqId(req, res);

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', id);
  });
});

describe('buildCustomProps', () => {
  it('extracts userId and roleId from authenticated requests', () => {
    const req = {
      user: { userId: 'user-123', roleId: 'role-456' },
    } as any;

    const props = buildCustomProps(req);

    expect(props.userId).toBe('user-123');
    expect(props.roleId).toBe('role-456');
  });

  it('returns undefined for userId and roleId on public routes', () => {
    const req = { user: undefined } as any;

    const props = buildCustomProps(req);

    expect(props.userId).toBeUndefined();
    expect(props.roleId).toBeUndefined();
  });
});

describe('parseLogRequestBodies', () => {
  it('defaults to true in non-production when env var is unset', () => {
    expect(parseLogRequestBodies(undefined, false)).toBe(true);
  });

  it('defaults to false in production when env var is unset', () => {
    expect(parseLogRequestBodies(undefined, true)).toBe(false);
  });

  it('returns true when env var is "true"', () => {
    expect(parseLogRequestBodies('true', true)).toBe(true);
    expect(parseLogRequestBodies('true', false)).toBe(true);
  });

  it('returns false when env var is "false"', () => {
    expect(parseLogRequestBodies('false', true)).toBe(false);
    expect(parseLogRequestBodies('false', false)).toBe(false);
  });
});

describe('REDACT_PATHS', () => {
  it('includes all expected sensitive field paths', () => {
    expect(REDACT_PATHS).toEqual([
      'req.body.password',
      'req.body.newPassword',
      'req.body.token',
      'req.cookies.refresh_token',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers.set-cookie',
    ]);
  });
});
