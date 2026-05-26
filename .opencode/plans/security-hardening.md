# Plan: Security hardening

**Branch:** `feat/security-hardening`
**Status:** In progress

## Goal

Harden the NestJS base template with minimal security middleware: helmet, CORS restriction, and trusted proxy configuration.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| CORS | Restrictive by default via `ALLOWED_ORIGINS` env var (comma-separated). If unset → same-origin only. | Cookie-based refresh tokens make origin restriction important. |
| Helmet | Default settings. | Covers CSP, HSTS, XFO, X-Content-Type-Options, Referrer-Policy, etc. — one line, no config burden. |
| CSRF | Skip. | Access token is Bearer header (immune). Refresh cookie uses SameSite=Strict, httpOnly, path-scoped to `/api/auth`. |
| Trust proxy | `TRUST_PROXY` env var, default `1`. | Without it, rate limiting and session IP capture see `127.0.0.1` behind any reverse proxy. |

## Steps

### Step 1 — Dependencies & env vars

- [x] `pnpm add helmet`
- [x] Add `ALLOWED_ORIGINS` to `src/config/env.ts`: `z.string().optional()`
- [x] Add `TRUST_PROXY` to `src/config/env.ts`: `z.coerce.number().default(1)`
- [x] Add both (commented) to `.env.example`

### Step 2 — Wire up main.ts

- [x] Import `helmet`
- [x] `app.use(helmet())` — defaults
- [x] Replace `app.enableCors()` with conditional: if `ALLOWED_ORIGINS` set → `enableCors({ origin: origins.split(','), credentials: true })`, else skip
- [x] `app.set('trust proxy', TRUST_PROXY)` after configService is available
- [x] Move `configService` fetch before middleware setup

### Step 3 — Verify

- [x] `pnpm lint` — no new errors introduced (97 pre-existing)
- [x] `pnpm test` — security e2e tests pass (5/5)
- [x] `pnpm build` — compiles successfully

### Step 4 — Code review fixes

- [x] `TRUST_PROXY` validation hardened to `z.coerce.number().int().nonnegative().default(1)`
- [x] Extracted shared `configureApp()` into `src/bootstrap.ts` to eliminate bootstrap duplication in tests
- [x] Fixed unsafe `afterAll` cleanup (`await app?.close()`)
- [x] Added TRUST_PROXY test coverage
- [x] Expanded helmet header assertions (CSP, HSTS)
