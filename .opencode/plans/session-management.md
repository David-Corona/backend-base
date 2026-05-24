# Plan: Session Management

## Goal

Let authenticated users list and terminate their own sessions (with metadata to distinguish them), and let admins list and terminate any user's sessions.

## Constraints & Decisions

- **Accept JWT revocation gap**: No blacklisting. Active JWTs (~15 min TTL) remain valid after session termination. Password change forces full revocation.
- **Reuse existing permissions**: `users:read` / `users:write` for admin endpoints. No new RBAC permission keys.
- **Minimal metadata**: Only `userAgent` and `ip` on the `Session` model. Nullable, captured when available.
- **No last-active tracking**: Out of scope.
- **No global cross-user session list**: Admin endpoints are per-user only.

## Step 1: Schema + metadata capture + JWT session ID

Adds the foundation: session metadata in the DB, session ID in the JWT (needed to identify "current session" in listing), and wired-up capture at login/refresh/change-password.

**Files changed:**
- `prisma/schema.prisma` — add nullable `userAgent` and `ip` fields to `Session` model
- Run `npx prisma migrate dev --name add_session_metadata`
- `src/modules/auth/auth.service.ts` — `login`, `refresh`, `changePassword` accept `{ userAgent?, ip? }`, store in `prisma.session.create`; sign JWT with `{ sub, roleId, sid: session.id }`
- `src/modules/auth/auth.controller.ts` — extract `req.headers['user-agent']` and `req.ip`, pass to service calls
- `src/modules/auth/strategies/jwt.strategy.ts` — add `sessionId` to payload type and returned value
- `src/common/dto/session-response.dto.ts` — new file: `SessionResponseDto { id, isCurrent, userAgent, ip, expiresAt, createdAt }`
- `src/modules/auth/auth.exceptions.ts` — add `SessionNotFoundException`, `CannotTerminateCurrentSessionException`
- `src/modules/auth/auth.service.spec.ts` — update all existing test mocks for new method signatures (userAgent/ip params, sid in JWT payload)

**Verification:**
- `npx prisma generate` succeeds
- `npx jest src/modules/auth/auth.service.spec.ts` passes (after updating mocks)
- `npx tsc --noEmit` compiles

## Step 2: User session management endpoints

Exposes session management for the currently authenticated user.

**Files changed:**
- `src/modules/auth/auth.service.ts` — add four methods:
  - `listSessions(userId, currentSessionId?)` → `SessionResponseDto[]`
  - `terminateSession(sessionId, { userId?, currentSessionId? })` → `void`
  - `terminateAllOtherSessions(userId, currentSessionId)` → `void`
  - `terminateAllSessions(userId)` → `void`
- `src/modules/auth/auth.controller.ts` — add three endpoints:
  - `GET /auth/sessions` — list own sessions (marks current via `req.user.sessionId`)
  - `DELETE /auth/sessions/:id` — terminate one session (blocks terminating current)
  - `DELETE /auth/sessions` — terminate all other sessions (204)
- `src/modules/auth/auth.service.spec.ts` — add test cases for all new service methods

**Verification:**
- `npx jest src/modules/auth/auth.service.spec.ts` passes
- `npx tsc --noEmit` compiles

## Step 3: Admin session management endpoints

Exposes session management for admins on any user.

**Files changed:**
- `src/modules/users/users.controller.ts` — add three endpoints:
  - `GET /users/:userId/sessions` (`users:read`) — list any user's sessions
  - `DELETE /users/:userId/sessions/:id` (`users:write`) — terminate a specific session
  - `DELETE /users/:userId/sessions` (`users:write`) — terminate all of a user's sessions
- `src/modules/users/users.module.ts` — import `AuthModule` (uses `AuthService` for session operations)
- `src/modules/auth/auth.service.spec.ts` — add tests for admin-facing paths (terminate all, terminate without currentSessionId restriction)

**Verification:**
- `npx jest src/modules/auth/auth.service.spec.ts` passes
- `npx tsc --noEmit` compiles

## Out of Scope

- Access token blacklisting / immediate JWT revocation
- `lastAccessedAt` tracking
- Admin-wide cross-user session list endpoint
- New RBAC permission keys
- Pagination on session lists (typically <10 per user)
