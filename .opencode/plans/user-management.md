# Plan: User Management

## Goal
Build a users module with admin CRUD, self-service profile, and shared pagination infrastructure.

## Resolved Decisions
1. **Add `name: String?`** to User model
2. **Single `UsersController`** with `/me` routes for self-service
3. **Move `PATCH /auth/users/:id/role`** → `PATCH /users/:id/role` in users module
4. **Build shared pagination** (`PaginationQueryDto` + `paginate()` helper) now
5. **Admin creates user** with email + password, `isVerified = true`
6. **Deactivate only** (`isActive = false`), no hard-delete
7. **Self-service updates name only**

## Out of Scope
- Email change / re-verification flow
- Password change endpoint
- Invitation / setup-link flow
- Refactoring roles list to use shared pagination
- Swagger decorators
- Hard-delete or reactivation endpoints

---

## Step 1: Infrastructure + Admin CRUD + Assign-role Migration

### Migration
- Add `name String?` to `User` model in `prisma/schema.prisma`
- Run `npx prisma migrate dev --name add-user-name`

### Shared pagination (`common/`)
- `common/dto/pagination-query.dto.ts` — `PaginationQueryDto` (page default 1 min 1, limit default 20 min 1 max 100)
- `common/dto/paginated-response.dto.ts` — `PaginatedResponse<T>` type
- `common/utils/pagination.ts` — `paginate()` helper (takes countFn + findManyFn, returns PaginatedResponse)

### Shared `UserResponseDto` (`common/dto/user-response.dto.ts`)
- Move from auth module to common; add `name` and `isActive` fields
- Fields: id, email, name, isActive, isVerified, role { id, name }, createdAt

### Move `UserAlreadyExistsException` to common (`common/exceptions/user-exceptions.ts`)
- Move from `auth.exceptions.ts` to shared exceptions
- Update auth to import from common

### Users module (`modules/users/`)
- `users.module.ts` — imports RolesModule (for role validation)
- `users.controller.ts` — all routes under `users`
- `users.service.ts` — all business logic
- `users.exceptions.ts` — UserAlreadyExistsException (already in common), DeactivatedSelfException
- DTOs: `create-user-request.dto.ts`, `update-user-request.dto.ts`, `assign-role-request.dto.ts`

### Endpoints

| Method | Route | Permission | Description |
|--------|-------|------------|-------------|
| `GET` | `/users` | `users:read` | Paginated list of users |
| `GET` | `/users/:id` | `users:read` | Single user by ID |
| `POST` | `/users` | `users:write` | Admin create user |
| `PATCH` | `/users/:id` | `users:write` | Admin update user (name, isActive) |
| `DELETE` | `/users/:id` | `users:delete` | Deactivate user (isActive = false) |
| `PATCH` | `/users/:id/role` | `users:assign-role` | Assign role (moved from auth) |

### Auth module cleanup
- Remove `assignRole` method from `AuthService`
- Remove `PATCH users/:id/role` route from `AuthController`
- Remove `AssignRoleRequestDto` import from auth controller
- Update auth's `UserResponseDto` import to use shared DTO

### Tests
- `users.service.spec.ts` — unit tests for all service methods
- Update `auth.e2e-spec.ts` — change assign-role test to hit `/api/users/:id/role`

## Step 2: Self-service Profile + E2E Tests

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| `GET` | `/users/me` | Any authenticated user | Get own profile |
| `PATCH` | `/users/me` | Any authenticated user | Update own name |

- `UpdateProfileRequestDto` — name (optional, string, max 255)
- `/me` routes use JwtAuthGuard only (no @RequirePermissions)
- Deactivated users blocked by auth guard checking isActive

### E2E tests (`test/users.e2e-spec.ts`)
- Admin CRUD: list, get, create, update, deactivate, assign-role
- Self-service: get own profile, update own name
- Error cases: not found, deactivated user, permission denied, validation
- Pagination: verify meta shape, defaults, custom params