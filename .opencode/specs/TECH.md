# TECH.md

## Stack (Non-Negotiable)

These are locked-in decisions. Do not substitute alternatives.

### Core
- **NestJS** — framework
- **TypeScript** — strict mode, no `any`
- **Express** — underlying HTTP server

### Database
- **PostgreSQL** — primary database
- **Prisma** — ORM, migrations, and schema management
- **Docker** — local PostgreSQL via Docker Compose

### Auth & Security
- **Passport** — authentication middleware
- **JWT** — access and refresh token strategy
- **bcryptjs** — password hashing

### Email
- **Resend** — email delivery
- **Handlebars** — HTML email templates

### Validation & Config
- **Zod** — environment variable validation
- **class-validator + class-transformer** — DTO validation and serialization
- **@nestjs/config** — configuration module, all config from environment variables

### Logging & Scheduling
- **nestjs-pino + pino-http** — structured HTTP and application logging
- **@nestjs/schedule** — cron jobs and background tasks

### Documentation
- **Swagger (@nestjs/swagger)** — API documentation, auto-generated and available at `/api/docs`

### Testing
- **Jest** — unit and integration tests
- **Supertest** — HTTP endpoint testing

### Tooling
- **ESLint** — enforced linting
- **pnpm** — package manager

---

## Validation Boundaries

These tools are not interchangeable. Using the wrong one in the wrong place is a common mistake that's easy to prevent by being explicit:

- **Zod**: Used strictly for parsing and validating environment variables (`process.env`) at application startup. Do not use Zod for request payloads.
- **class-validator / class-transformer**: Used exclusively for incoming HTTP Request DTO validation and serialization in controllers. Do not use it for environment variables.

---

## Local Development

### Docker & Database Conventions

- The Docker container for the backend service is named `backend-base`, and the Postgres container is named `backend-base-db`.
- The Postgres database name is `base_app`. This applies to `docker-compose.yml`, `.env`, and any other config files.
- The Postgres host port mapping is `5433:5432` (to avoid conflict with other local Postgres instances on 5432).
- The Docker volume is named `base_app_postgres_data`.
- Do not revert or rename any of these values.