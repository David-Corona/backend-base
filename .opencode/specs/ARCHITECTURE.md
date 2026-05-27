# ARCHITECTURE.md

Invariants, not suggestions.

---

## Layering

- **Controllers**: no Prisma, no business logic. Only routing and request/response parsing.
- **Services**: only layer that touches Prisma or performs transactions. Never return Prisma models — map to DTOs.
- **Guards**: auth/authorization only. No writes, no side effects.
- **DTOs** are the only things that cross layer or module boundaries.

## Database

- Never query in a loop. Batch queries.
- Migrations are append-only. Never edit a committed migration — write a new one.


## Error Handling

- All errors use the `AppException` hierarchy. Never throw raw `Error` or NestJS built-ins.
- Services throw domain exceptions (e.g. `UserNotFoundException`).
- The global exception filter is the only place that maps exceptions to HTTP responses.

## Auth & Permissions

- Route protection via decorators + guards, never inside service logic.
- Services assume the request is already authorized.
- Public routes marked with `@Public()`. Everything else is protected by default.

## Modules

- Feature modules are isolated. No direct cross-module service imports — use interfaces or events.
- Shared utilities, decorators, guards, filters, pipes live in `common/`.

## Side Effects & Config

- Emails, events, scheduled tasks are triggered from services only.

## Logging

- Pino logger only. No `console.log`.
- Structured objects: `logger.info({ userId, action }, 'message')`.
- Pass full `Error` to `err` field: `logger.error({ err: error }, '...')`.

## Validation Boundaries

- **Zod**: environment variables only, at startup. Never for request payloads.
- **class-validator / class-transformer**: HTTP request DTOs only. Never for env vars.

## TypeScript

- Strict mode. No `any`.

## Docker & Database Conventions

- Backend container: `backend-base`, Postgres container: `backend-base-db`.
- Database name: `base_app`.
- Postgres port mapping: `5433:5432`.
- Volume: `base_app_postgres_data`.
- Do not rename any of these.

## Naming

- Booleans: `is`/`has` prefix — `isVerified`, `isActive`
- Timestamps: `At` suffix — `createdAt`, `expiresAt`
- Permissions: `resource:action` — `users:read`, `users:delete`
- Swagger decorators: `*.docs.ts` alongside the controller
- Tests: `*.spec.ts` alongside the file under test