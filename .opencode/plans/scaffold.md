# Plan: NestJS Scaffold

## Goal

Create the NestJS project scaffolding — directory structure, config, core infrastructure (Prisma, logger, exception filter), and a health endpoint — so feature work can begin.

---

## Step 1: Project init, tooling, and directory structure

Initialize the NestJS project with all dependencies and config. Create the full directory structure (empty dirs with `.gitkeep` where needed). Configure TypeScript (strict mode + `@/` path alias), ESLint (typescript-eslint with stylistic rules, no Prettier), and Jest (with `jest-mock-extended` and `moduleNameMapper` for `@/`). Add `.env.example`, `.gitignore`, and `docker-compose.yml` for Postgres.

- Verify: `pnpm build` and `pnpm lint` pass. `pnpm test` runs (no tests yet, exits cleanly).

## Step 2: Prisma, database, and minimal User model

Initialize Prisma with PostgreSQL provider. Write the minimal `User` model (id, email, password, isActive, isVerified, createdAt, updatedAt). Run the initial migration against the Docker Postgres. Create `PrismaModule` and `PrismaService` (with graceful shutdown hook). Wire `PrismaModule` into `AppModule`.

- Verify: `npx prisma migrate dev` succeeds. App starts and PrismaService connects without error.

## Step 3: Core infrastructure — config, logger, exception hierarchy

Set up three pieces of shared infrastructure:

1. **ConfigModule** — validate env vars with Zod schema (`DATABASE_URL`, `PORT`, `NODE_ENV`), expose via `@nestjs/config`. No `process.env` outside this module.
2. **LoggerModule** — nestjs-pino with pino-http, structured logging config (`logger.info({ userId }, 'message')` style).
3. **Exception hierarchy + global filter** — `AppException` base class inheriting from `Error`, domain exceptions as flat subclasses (`NotFoundException`, `UnauthorizedException`, etc. as convenience bases, `UserNotFoundException` as example domain exception). Global exception filter maps to the `{ statusCode, error, message, code }` shape from api.md. Register filter globally in `main.ts`.

- Verify: App starts with Pino logging visible. Calling `throw new AppException(...)` inside a test controller route returns the correct error shape and status code. `process.env` references only exist in `config/`.

## Step 4: Bootstrap, AppModule, and health endpoint

Write `main.ts` (bootstrap NestFactory, enable CORS, set global prefix `/api`, register global exception filter and Pino logger). Wire everything into `AppModule`. Create a `HealthModule` with a single public `GET /api/health` endpoint returning `{ status: "ok" }` — marked `@Public()` so it bypasses auth (decorator stub only, no guard wiring yet). Add a basic e2e test that hits `/api/health`.

- Verify: `pnpm start` and `GET /api/health` returns `200` with `{ status: "ok" }`. e2e test passes.

---

## Out of scope

- Auth module (registration, login, JWT, Passport, sessions, refresh tokens)
- RBAC (roles, permissions, PermissionsGuard)
- Email (Resend, Handlebars templates)
- User CRUD endpoints
- Swagger / API documentation setup
- CI/CD pipelines