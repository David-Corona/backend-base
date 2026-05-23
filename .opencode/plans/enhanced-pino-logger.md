# Enhanced Pino Logger

## Goal

Configure the existing `nestjs-pino` logger to capture useful request context (body, user, request ID) with sensitive field redaction, while providing a `LOG_REQUEST_BODIES` toggle for volume control in production.

## Key decisions

1. **Standard detail + error-only response bodies** — Log request bodies on non-GETs, query params, and user context for all requests. Log response bodies only on errors (4xx/5xx). Success response bodies are redundant noise.
2. **Pino native `redact`** — Declarative list of sensitive paths (`req.body.password`, `req.body.newPassword`, `req.body.token`, `req.cookies.refresh_token`). Built-in, easy to audit.
3. **Always-on for errors, toggleable for success request bodies** — Errors always log full context. A `LOG_REQUEST_BODIES` env var (default `true` in dev, `false` in prod) controls whether successful requests log their bodies. Simple escape hatch, no overhead when off.
4. **Request ID + userId + roleId + X-Request-Id header** — Mix in `req.user` fields and propagate `req.id` as a response header.
5. **Convention + enforceable patterns** — Document in architecture spec: structured objects only (no string interpolation), always include domain IDs, `warn` for handled errors, `error` for unexpected. No custom wrapper needed.
6. **Keep current format** — Pretty in dev via `pino-pretty`, JSON to stdout in prod. No file transports.

## Steps

### Step 1: Logger configuration, env var, and redaction

- Add `LOG_REQUEST_BODIES` to `src/config/env.ts` (boolean, default `true` in dev/test, `false` in prod)
- Rewrite `src/logger/logger.module.ts`:
  - Custom `req` serializer that includes `body` (conditional on `LOG_REQUEST_BODIES`), `query`, plus `userId`/`roleId` from `req.user`
  - Custom `res` serializer that captures body only on error status codes (4xx/5xx)
  - `redact` paths for sensitive fields
  - Always log errors; conditionally log success bodies via toggle
  - `genReqId` + `setReplyHeaders` for `X-Request-Id`
- `src/types/express.d.ts` — no changes needed

### Step 2: Update service-level logging + architecture spec

- `src/modules/auth/auth.service.ts` — pass full `Error` objects (not `error.message`) to logger for stack traces
- `src/common/filters/app-exception.filter.ts` — pass full `Error` object for unhandled exceptions
- `.opencode/specs/ARCHITECTURE.md` — expand Logging Rules section

### Step 3: Logger integration tests

- `src/logger/logger.module.spec.ts` — test body toggle, redaction, context mixin, request ID header
- `src/config/env.spec.ts` — test env defaults

## Out of scope

- Per-request child loggers that accumulate arbitrary context
- Custom logging wrapper/service class
- File rotation or log shipping
- Log sampling or rate limiting
- Correlation IDs across distributed services
