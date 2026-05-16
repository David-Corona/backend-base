# TECH.md

## Stack (Non-Negotiable)

These are locked-in decisions. Do not substitute alternatives.

### Core
- **NestJS v11** — framework
- **TypeScript** — strict mode, no `any`
- **Express** — underlying HTTP server

### Database
- **PostgreSQL** — primary database
- **Prisma** — ORM, migrations, and schema management
- **Docker** — local PostgreSQL via Docker Compose

### Auth & Security
- **Passport** — authentication middleware
- **JWT** — access and refresh token strategy
- **bcrypt** — password hashing

### Email
- **Resend** — email delivery
- **Handlebars** — HTML email templates

### Validation & Config
- **Zod** — environment variable validation
- **class-validator + class-transformer** — DTO validation and serialization
- **@nestjs/config** — configuration module, all config from environment variables

### Validation Boundaries
- **Zod**: Used strictly for parsing and validating environment variables (`process.env`) at application startup. Do not use Zod for request payloads.
- **class-validator / class-transformer**: Used exclusively for incoming HTTP Request DTO validation and serialization in controllers.

### Logging & Scheduling
- **nestjs-pino + pino-http** — structured HTTP and application logging
- **@nestjs/schedule** — cron jobs and background tasks

### Documentation
- **Swagger (@nestjs/swagger)** — API documentation, auto-generated and available at `/api/docs`. 
- **Jest** — unit and integration tests
- **Supertest** — HTTP endpoint testing

### Tooling
- **ESLint** — enforced linting
- **pnpm** — package manager

---

## Quality Bar

- Strict TypeScript throughout — no implicit `any`, no type shortcuts
- Every endpoint validated via DTOs
- Consistent, structured error responses across the entire API
- Pino used for observability, not ad-hoc `console.log`
- Migrations committed to version control
- Seed script for local development
- Unit tests for services, e2e tests for critical auth flows