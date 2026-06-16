import {
  buildReqSerializer,
  buildResSerializer,
  buildGenReqId,
  buildCustomProps,
  REDACT_PATHS,
} from './logger.module';

describe('buildReqSerializer', () => {
  const baseReq = {
    id: 'req-id-123',
    method: 'POST',
    url: '/api/auth/login',
    path: '/api/auth/login',
    params: {},
    query: { foo: 'bar' },
    cookies: { refresh_token: 'abc123' },
    headers: {
      'user-agent': 'test-agent',
      'x-forwarded-for': '1.2.3.4',
    },
    socket: { remoteAddress: '127.0.0.1' },
    body: { email: 'test@example.com', password: 'secret123' },
    user: { userId: 'user-1', roleId: 'role-1' },
  };

  it('returns request metadata', () => {
    const serializer = buildReqSerializer();
    const result = serializer(baseReq as any);

    expect(result.id).toBe('req-id-123');
    expect(result.method).toBe('POST');
    expect(result.url).toBe('/api/auth/login');
    expect(result.path).toBe('/api/auth/login');
    expect(result.params).toEqual({});
    expect(result.query).toEqual({ foo: 'bar' });
    expect(result.cookies).toEqual({ refresh_token: 'abc123' });
    expect(result.remoteAddress).toBe('1.2.3.4');
    expect(result.userAgent).toBe('test-agent');
  });

  it('falls back to socket remoteAddress when x-forwarded-for is missing', () => {
    const serializer = buildReqSerializer();
    const reqWithoutForwardedFor = { ...baseReq, headers: { 'user-agent': 'test-agent' } };
    const result = serializer(reqWithoutForwardedFor as any);

    expect(result.remoteAddress).toBe('127.0.0.1');
  });

  it('handles requests without cookies', () => {
    const serializer = buildReqSerializer();
    const reqWithoutCookies = { ...baseReq, cookies: undefined };
    const result = serializer(reqWithoutCookies as any);

    expect(result.cookies).toBeUndefined();
  });
});

describe('buildResSerializer', () => {
  it('returns statusCode and contentLength', () => {
    const serializer = buildResSerializer();
    const res = {
      statusCode: 200,
      headers: { 'content-length': '123' },
    };
    const result = serializer(res as any);

    expect(result.statusCode).toBe(200);
    expect(result.contentLength).toBe('123');
  });

  it('handles missing contentLength', () => {
    const serializer = buildResSerializer();
    const res = { statusCode: 204 };
    const result = serializer(res as any);

    expect(result.statusCode).toBe(204);
    expect(result.contentLength).toBeUndefined();
  });
});

describe('buildGenReqId', () => {
  it('uses req.id when available', () => {
    const genReqId = buildGenReqId();
    const req = { id: 'existing-id', headers: {} } as any;
    const res = { setHeader: jest.fn() } as any;

    const id = genReqId(req, res);

    expect(id).toBe('existing-id');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'existing-id');
  });

  it('uses x-request-id header when req.id is not available', () => {
    const genReqId = buildGenReqId();
    const req = { id: undefined, headers: { 'x-request-id': 'header-id-123' } } as any;
    const res = { setHeader: jest.fn() } as any;

    const id = genReqId(req, res);

    expect(id).toBe('header-id-123');
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'header-id-123');
  });

  it('generates a UUID when no id is available', () => {
    const genReqId = buildGenReqId();
    const req = { id: undefined, headers: {} } as any;
    const res = { setHeader: jest.fn() } as any;

    const id = genReqId(req, res);

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', id);
  });
});

describe('buildCustomProps', () => {
  const baseReq = {
    user: { userId: 'user-123', roleId: 'role-456' },
    body: { email: 'test@example.com', password: 'secret123' },
  };

  const baseRes = {
    locals: {
      errorResponseBody: {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid token',
      },
    },
  };

  it('extracts userId and roleId from authenticated requests', () => {
    const props = buildCustomProps(baseReq as any, baseRes as any);
    expect(props.userId).toBe('user-123');
    expect(props.roleId).toBe('role-456');
  });

  it('returns undefined for userId and roleId on public routes', () => {
    const req = { ...baseReq, user: undefined };
    const props = buildCustomProps(req as any, baseRes as any);
    expect(props.userId).toBeUndefined();
    expect(props.roleId).toBeUndefined();
  });

  it('includes requestBody when req.body is present', () => {
    const props = buildCustomProps(baseReq as any, baseRes as any);
    expect(props.requestBody).toEqual(baseReq.body);
  });

  it('omits requestBody when req.body is empty', () => {
    const req = { ...baseReq, body: {} };
    const props = buildCustomProps(req as any, baseRes as any);
    expect(props.requestBody).toBeUndefined();
  });

  it('includes responseBody when res.locals.errorResponseBody is present', () => {
    const props = buildCustomProps(baseReq as any, baseRes as any);
    expect(props.responseBody).toEqual(baseRes.locals.errorResponseBody);
  });

  it('omits responseBody when res.locals.errorResponseBody is not present', () => {
    const res = { locals: {} };
    const props = buildCustomProps(baseReq as any, res as any);
    expect(props.responseBody).toBeUndefined();
  });
});

describe('REDACT_PATHS', () => {
  it('includes all expected sensitive field paths', () => {
    expect(REDACT_PATHS).toEqual([
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
    ]);
  });
});
