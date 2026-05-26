# Plan: Health Check with @nestjs/terminus

## Goal

Replace the static `{ status: "ok" }` health endpoint with a proper health check that verifies critical dependencies (database) and returns standardized status codes suitable for orchestration tools.

## Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Library | `@nestjs/terminus` | Official NestJS health check, standard format, easy per-project extension |
| DB check | Custom Prisma health indicator via `$queryRaw` | No built-in Prisma support in Terminus; lightweight check with `SELECT 1` |
| Response format | Terminus default (status, info, error, details) | Standard format that K8s/Docker/monitoring tools expect |
| Status codes | 200 healthy / 503 unhealthy | Industry standard for orchestration probes |
| Current decorators | Keep `@SkipThrottle()` and `@Public()` | Already correct; no functional change |

## Step 1 (build): Dependencies + Prisma health indicator + module wiring

Add `@nestjs/terminus`, create a custom Prisma health indicator service, update the module to import TerminusModule and provide the indicator, and update the controller to use HealthCheckService.

**Files changed:**
- `package.json` — add dependencies
- New: `src/modules/health/prisma-health-indicator.ts` — health indicator that runs `SELECT 1` via PrismaService
- `src/modules/health/health.module.ts` — import TerminusModule, provide PrismaHealthIndicator
- `src/modules/health/health.controller.ts` — inject HealthCheckService + PrismaHealthIndicator, use `@HealthCheck()` decorator

**Verification:**
- `GET /api/health` returns 200 with standard Terminus JSON when DB is up
- `GET /api/health` returns 503 when DB is down
- Existing decorators (`@Public`, `@SkipThrottle`) preserved
- `npx tsc --noEmit` compiles

## Out of scope

- Disk/memory health indicators (add per-project if needed)
- Custom health indicator for external services (Redis, etc.)
- Health check UI or dashboard
- Metrics export (Terminus does not provide this)
- Graceful shutdown handling
