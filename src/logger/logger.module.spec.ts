import {
  buildGenReqId,
  buildResSerializer,
  buildCustomProps,
  REDACT_PATHS,
} from './logger.module';

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

describe('buildResSerializer', () => {
  it('returns statusCode and only allowed headers', () => {
    const serializer = buildResSerializer();
    const res = {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'content-length': '123',
        etag: 'W/"123"',
        'x-request-id': 'req-123',
        'x-ratelimit-limit': '60',
        'x-ratelimit-remaining': '59',
        'x-ratelimit-reset': '60',
        'content-security-policy': "default-src 'self'",
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
      },
    };
    const result = serializer(res as any);

    expect(result.statusCode).toBe(200);
    expect(result.headers).toEqual({
      'content-type': 'application/json',
      'content-length': '123',
      etag: 'W/"123"',
      'x-request-id': 'req-123',
      'x-ratelimit-limit': '60',
      'x-ratelimit-remaining': '59',
      'x-ratelimit-reset': '60',
    });
  });

  it('handles missing headers', () => {
    const serializer = buildResSerializer();
    const res = { statusCode: 204, headers: {} };
    const result = serializer(res as any);

    expect(result.statusCode).toBe(204);
    expect(result.headers).toEqual({});
  });
});

describe('buildCustomProps', () => {
  const baseReq = {
    headers: { 'user-agent': 'test-agent' },
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
    const props = buildCustomProps(baseReq as any, baseRes as any, false, false);
    expect(props.userId).toBe('user-123');
    expect(props.roleId).toBe('role-456');
  });

  it('returns undefined for userId and roleId on public routes', () => {
    const req = { ...baseReq, user: undefined };
    const props = buildCustomProps(req as any, baseRes as any, false, false);
    expect(props.userId).toBeUndefined();
    expect(props.roleId).toBeUndefined();
  });

  it('includes userAgent from headers', () => {
    const props = buildCustomProps(baseReq as any, baseRes as any, false, false);
    expect(props.userAgent).toBe('test-agent');
  });

  it('includes requestBody when logRequestBodies is true', () => {
    const props = buildCustomProps(baseReq as any, baseRes as any, true, false);
    expect(props.requestBody).toEqual(baseReq.body);
  });

  it('omits requestBody when logRequestBodies is false', () => {
    const props = buildCustomProps(baseReq as any, baseRes as any, false, false);
    expect(props.requestBody).toBeUndefined();
  });

  it('omits requestBody when req.body is empty', () => {
    const req = { ...baseReq, body: {} };
    const props = buildCustomProps(req as any, baseRes as any, true, false);
    expect(props.requestBody).toBeUndefined();
  });

  it('includes responseBody when logResponseBodies is true and errorResponseBody is present', () => {
    const props = buildCustomProps(baseReq as any, baseRes as any, false, true);
    expect(props.responseBody).toEqual(baseRes.locals.errorResponseBody);
  });

  it('omits responseBody when logResponseBodies is false', () => {
    const props = buildCustomProps(baseReq as any, baseRes as any, false, false);
    expect(props.responseBody).toBeUndefined();
  });

  it('omits responseBody when res.locals.errorResponseBody is not present', () => {
    const res = { locals: {} };
    const props = buildCustomProps(baseReq as any, res as any, false, true);
    expect(props.responseBody).toBeUndefined();
  });

  it('prefers responseBody over errorResponseBody when both are present', () => {
    const res = {
      locals: {
        responseBody: { data: 'success' },
        errorResponseBody: { statusCode: 400, error: 'Bad Request' },
      },
    };
    const props = buildCustomProps(baseReq as any, res as any, false, true);
    expect(props.responseBody).toEqual({ data: 'success' });
  });
});

describe('REDACT_PATHS', () => {
  it('includes all expected sensitive field paths', () => {
    expect(REDACT_PATHS).toEqual([
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
    ]);
  });
});
