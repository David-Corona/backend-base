# Plan: Auth Module

## Decisions (from grilling session)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Session model | Separate `Session` table (opaque refresh token hash, expiresAt, userId FK) |
| 2 | Refresh token format | Opaque random string, SHA-256 hashed in DB |
| 3 | Verification gate | Cannot log in until email verified (`isVerified` check from step 1) |
| 4 | Registration response | 201 with `{ message }` only — no tokens |
| 5 | Token delivery | Access token in response body, refresh token in `httpOnly` cookie (`sameSite=strict`, `path=/api/auth`) |
| 6 | Gate timing | `isVerified` check enforced from day one; test by manually flipping DB flag |
| 7 | Verification/reset tokens | `VerificationToken` table with `type` enum (`EMAIL_VERIFICATION`, `PASSWORD_RESET`) |

---

## Step 1: Schema + Registration

Add `Session`, `VerificationToken`, and `TokenType` enum to Prisma schema. Run migration. Create `AuthModule` with controller and service. Implement `POST /api/auth/register` — validate input (class-validator DTO), hash password with bcryptjs, create user (`isVerified = false`), return `201` with `{ message: "Registration successful..." }`. Create `UserAlreadyExistsException` (extends `ConflictException`, code `USER_ALREADY_EXISTS`) in auth module.

- **Verify:** `POST /api/auth/register` returns 201 with message, user row created in DB with hashed password. Duplicate email returns 409 `USER_ALREADY_EXISTS`. Unit tests for `AuthService.register`. E2E test for the endpoint.

## Step 2: Login + JWT + Auth Guard

Configure `JwtModule` (env-driven secret + access expiration). Create `JwtStrategy` (Passport) validating `{ sub: userId }` tokens. Create `JwtAuthGuard` in `common/guards/` — checks JWT via Passport, skips routes marked `@Public()`. Wire guard globally. Implement `POST /api/auth/login` — validate credentials, check `isVerified` (throw `ForbiddenException` code `EMAIL_NOT_VERIFIED` if false), create `Session` row with SHA-256 hashed opaque refresh token, set `httpOnly` cookie with raw token, return `{ accessToken, user }` in body. Login DTO with class-validator. User response DTO (`id`, `email`, `isVerified`, `createdAt` — never leak password). Auth exceptions: `InvalidCredentialsException` (401, `INVALID_CREDENTIALS`), `EmailNotVerifiedException` (403, `EMAIL_NOT_VERIFIED`).

- **Verify:** Login with verified user returns 200 + access token + cookie. Login with wrong password returns 401. Login with unverified user returns 403. `GET /api/health` (public) still works without token. Any non-public route without token returns 401. Unit + E2E tests.

## Step 3: Refresh + Logout

Implement `POST /api/auth/refresh` — read refresh token from cookie, hash it, look up `Session`, validate expiry, delete old session, create new session with new opaque token (rotation), set new cookie, return `{ accessToken }`. Implement `POST /api/auth/logout` — hash cookie token, delete `Session` row, clear cookie (`Set-Cookie` with `maxAge=0`), return 204. Auth exceptions: `InvalidRefreshTokenException` (401, `INVALID_REFRESH_TOKEN`). Both endpoints marked `@Public()` since refresh doesn't use JWT and logout needs to work even with expired access tokens. Add `DELETE ON CASCADE` on Session → User relation in Prisma so deleting a user cleans up sessions.

- **Verify:** Refresh returns new access token + new cookie, old cookie token is invalid. Logout returns 204 + cleared cookie. Expired refresh token returns 401. Rotation invalidates previous token (replay protection). Unit + E2E tests.

## Step 4: Email Verification

Create `EmailModule` with `EmailService` — wrapper around Resend, `sendVerificationEmail(to, token)` and later `sendPasswordResetEmail(to, token)`. Handlebars HTML templates for each email type. Modify registration to create an `EMAIL_VERIFICATION` `VerificationToken` (random opaque token, SHA-256 hashed in DB, expires in 24h) and call `EmailService.sendVerificationEmail`. Implement `GET /api/auth/verify-email?token=...` — hash incoming token, look up `VerificationToken` where `type = EMAIL_VERIFICATION` and `usedAt IS NULL`, check expiry, mark user `isVerified = true`, set token `usedAt`, return `{ message }`. Invalidate any other pending verification tokens for that user. Auth exceptions: `InvalidTokenException` (400, `INVALID_TOKEN`), `TokenExpiredException` (400, `TOKEN_EXPIRED`), `AlreadyVerifiedException` (409, `EMAIL_ALREADY_VERIFIED`). Add `RESEND_API_KEY` and `FROM_EMAIL` as required env vars (they're currently optional in the Zod schema — make them required).

- **Verify:** Registration sends email with verification link. Clicking link verifies user, subsequent login succeeds. Re-using token returns `INVALID_TOKEN`. Already-verified user returns `EMAIL_ALREADY_VERIFIED`. Unit + E2E tests (mock email service for E2E).

## Step 5: Password Reset

Implement `POST /api/auth/forgot-password` — find user by email (always return 200 `{ message }` to prevent email enumeration), create `PASSWORD_RESET` `VerificationToken` (expires in 1h), invalidate any existing reset tokens for that user, send password reset email. Implement `POST /api/auth/reset-password` — validate token (hash lookup, type check, expiry, not used), update user password hash, mark token `usedAt`, return `{ message }`. Handlebars template for reset email. Reuse `InvalidTokenException` and `TokenExpiredException` from step 4.

- **Verify:** Forgot-password for existing user sends email, returns 200. Forgot-password for non-existent email also returns 200 (no leak). Reset-password with valid token works. Re-using reset token returns `INVALID_TOKEN`. Expired token returns `TOKEN_EXPIRED`. Unit + E2E tests.

---

## Out of scope

- RBAC / roles / permissions / `PermissionsGuard`
- User admin CRUD endpoints
- User self-service profile endpoints
- Swagger decorator files
- "Change password" for authenticated users
- "List active sessions" / "Revoke all sessions"
- Rate limiting on auth endpoints
- Account lockout after failed attempts
