# Plan: Rate Limiting

**Goal:** Add IP-based rate limiting using `@nestjs/throttler` — a generous
default tier (60/min) and a stricter auth tier (10/min) — with proper error
integration and env-var configuration.

## Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Library | `@nestjs/throttler` | Official NestJS, guard-based, decorator API |
| Storage | In-memory | No new infra, single-instance app |
| Strategy | Single throttler with per-route `@Throttle` override | Default 60/min applies to all routes; auth strict endpoints override limit to 10/min via `@Throttle({ default: { limit: AUTH_RATE_LIMIT } })` using a module-level constant from `process.env`; no `@SkipThrottle` needed anywhere except health |
| Dimension | By IP | Standard, works for anonymous endpoints |
| Config | 3 env vars with defaults | Matches project convention, tunable per environment |
| Error shape | `ThrottlerException` → 429 + code `RATE_LIMITED` | Consistent with existing `AppExceptionFilter` |

## Step 1 (build): Throttler infrastructure + default tier

Wire up `@nestjs/throttler` end-to-end with the default rate limit enforced on
all routes, and `ThrottlerException` producing the standard error response shape.

Files:
- `src/config/env.ts` — add `RATE_LIMIT_TTL`, `RATE_LIMIT_DEFAULT`, `RATE_LIMIT_AUTH`
- `.env.example` — add the three new vars with defaults
- New: `src/common/throttler/throttler.module.ts` — forRootAsync with env vars
- `src/app.module.ts` — import ThrottlerModule, add ThrottlerGuard as APP_GUARD
- `src/common/filters/app-exception.filter.ts` — ThrottlerException branch
- `test/app-exception.filter.spec.ts` — test 429 error shape

## Step 2 (build): Auth tier + health skip + e2e tests

Apply per-endpoint overrides and verify with e2e tests.

Files:
- `src/modules/auth/auth.controller.ts` — `@Throttle()` on strict auth endpoints
- `src/modules/health/health.controller.ts` — `@SkipThrottle()`
- New: `test/throttler.e2e-spec.ts` — e2e tests for all three tiers

## Step 3 (build): Single throttler with module-level constant

Simplified to a single `default` throttler with per-route `@Throttle` overrides.
Auth strict endpoints override the limit to 10/min via a module-level constant
`AUTH_RATE_LIMIT` that reads `process.env.RATE_LIMIT_AUTH`. No `@SkipThrottle`
annotations on non-auth controllers — they inherit the default 60/min.

Changes:
- `src/common/throttler/throttler.module.ts` — single `default` throttler
- `src/modules/auth/auth.controller.ts` — `AUTH_RATE_LIMIT` constant from
  `process.env`; `@Throttle({ default: { limit: AUTH_RATE_LIMIT } })` on 6
  strict endpoints; no decorators on refresh/logout (default 60/min)
- `src/modules/users/users.controller.ts` — removed `@SkipThrottle`
- `src/modules/roles/roles.controller.ts` — removed `@SkipThrottle`
- `src/modules/roles/permissions.controller.ts` — removed `@SkipThrottle`
- `.opencode/plans/rate-limiting.md` — updated strategy and step 3

## Out of scope

- Redis storage, per-user limits, X-RateLimit headers, multi-tier beyond auth