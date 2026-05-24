# ARCHITECTURE.md

These are invariants. They are not suggestions. Every module, every file, every agent session must follow these rules without exception.

---

## Layering Rules

- **Controllers** handle routing, parse request/response, and call services. Nothing else. No Prisma, no business logic, no conditionals beyond input parsing.
- **Services** own all business logic. They are the only layer that talks to Prisma. They are the only layer that performs database transactions.
- **Guards** handle authentication and authorization checks only. No business logic, no database writes, no side effects.
- **DTOs** are the only things that cross module or layer boundaries. Services never return Prisma models. Controllers never receive raw entities.

## Database Rules

- Prisma is only ever imported and used inside services, never in controllers, guards, decorators, or interceptors.
- Transactions are only performed inside services.
- Never query the database in a loop. Batch queries.
- All Prisma models are treated as internal. Map to a response DTO before returning from a service.
- Migrations are written, never edited. Once a migration has been committed, never modify it — write a new migration that supersedes it. Editing committed migrations breaks every environment that already ran the old version.

## Error Handling Rules

- All errors use the `AppException` hierarchy. Never throw raw `Error`, never throw NestJS built-ins directly.
- Services throw domain-specific exceptions (e.g. `UserNotFoundException`, `InvalidTokenException`).
- The global exception filter is the only place that translates exceptions to HTTP responses.
- Never return error information in a success response shape. Errors always go through the exception filter.

### Exception Mapping

When a service throws a domain exception, the global exception filter maps it to the API error shape. Examples:

- `UserNotFoundException` → HTTP 404 (Not Found), code: `USER_NOT_FOUND`
- `InvalidTokenException` → HTTP 401 (Unauthorized), code: `INVALID_TOKEN`

## Auth & Permissions Rules

- Route protection is always via decorators + guards, never inside service logic.
- Permissions are checked by the `PermissionsGuard` using the `@RequirePermissions()` decorator.
- Services do not check permissions. Services assume the request is already authorized.
- Public routes are explicitly marked with `@Public()`. Everything else is protected by default.

## Module Rules

- Feature modules are isolated. A module should not import another feature module's service directly. Cross-module communication goes through clearly defined interfaces or events.
- No circular dependencies. If you feel the need for one, the responsibility is in the wrong module.
- Shared utilities, decorators, guards, filters, and pipes live in `common/`. They have no feature-specific knowledge.

## State & Side Effects

- No shared mutable state between requests.
- Side effects (emails, events, scheduled tasks) are triggered from services, not controllers or guards.
- Configuration should be read from `@nestjs/config`. `process.env` may only be read where `ConfigService` cannot be injected.

## Logging Rules

- Use the injected Pino logger only. No `console.log`, no `console.error`.
- Log structured objects, not interpolated strings. `logger.info({ userId, action }, 'User action')` not `logger.info('User ' + userId + ' did ' + action)`.
- Log meaningful business events (login, registration, password reset) not implementation details.
- Always pass the full `Error` object (not `error.message`) to the `err` field so the log includes the stack trace: `logger.error({ err: error }, '...')` or `logger.warn({ err: error instanceof Error ? error : String(error) }, '...')`.
- Include domain-specific IDs (`userId`, `roleId`, `email`) in log context objects when available.
- Use log levels consistently: `error` for unexpected failures, `warn` for handled business errors, `info` for notable events, `debug` for development tracing.

## Naming Conventions

All naming rules for the project live here. Other specs reference this section rather than duplicating it.

- Files: `kebab-case` — `users.service.ts`, `create-user.dto.ts`
- Classes: `PascalCase` — `UsersService`, `CreateUserDto`
- Variables and functions: `camelCase`
- Database fields: `camelCase` (Prisma default)
- JSON keys: `camelCase`
- REST endpoints / URL paths: `kebab-case` — `/api/auth/reset-password`
- URL path parameters: `camelCase` — `/api/users/:userId`
- Query parameters: `camelCase` — `?sortBy=createdAt`
- Boolean fields: prefixed with `is` or `has` — `isVerified`, `isActive`
- Timestamp fields: suffixed with `At` — `createdAt`, `updatedAt`, `expiresAt`
- Permissions: `resource:action` format — `users:read`, `users:write`, `users:delete`
- Environment variables: `SCREAMING_SNAKE_CASE`
- Swagger decorator files: `*.docs.ts` alongside the controller
- Test files: `*.spec.ts` alongside the file under test