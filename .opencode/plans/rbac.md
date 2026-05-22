# RBAC Feature Plan

## Goal

Implement role-based access control where each user has one role, roles have permissions from a fixed set defined in code, and route enforcement is permission-based via `@RequirePermissions` + `PermissionsGuard`.

## Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Permission universe | Fixed set defined in code | Prevents typos, gives compile-time safety; still stored in DB for FK integrity |
| Role ↔ User | Single role per user (FK on User) | Simpler, sufficient for a starter; migration path exists for multi-role later |
| Permission storage | Dedicated `Permission` table seeded from code | FK constraint prevents invalid strings; queryable |
| JWT payload | `userId` + `roleId` | Permission changes take effect immediately; one indexed DB query per request |
| Module structure | Separate `RolesModule` | Keeps `AuthModule` focused; guard lives in `common/` |
| Role/perm management | Full CRUD API for roles | RBAC is useless if you can't change mappings without redeploy |
| `users:assign-role` | Separate permission from `users:write` | Role escalation is security-sensitive |
| Delete role with users | Reject — must reassign first | Prevents dangling FKs or cascade-deleting users |
| `roleId` on User | Required, not nullable | Every user gets `user` role on registration |

## Schema

```
User.roleId → Role.id (required FK)
Role ←── RolePermission ──→ Permission
RolePermission: composite PK (roleId, permissionId)
Permission: id (PK), key (unique), name, description
```

## Default Seed

- **Roles:** `admin` (all permissions), `user` (none)
- **Permissions:** `users:read`, `users:write`, `users:delete`, `users:assign-role`, `roles:read`, `roles:write`, `roles:delete`

## Plan Steps

### Step 1: RBAC Foundation + Roles CRUD API

**What you can do after this step:** Create roles, assign permissions to roles, list roles, list permissions — all protected by `@RequirePermissions`.

**New files:**
- `prisma/migrations/<timestamp>_add_rbac/` — migration
- `prisma/seed.ts` — seed script
- `src/common/permissions.ts` — permission constants
- `src/common/decorators/require-permissions.decorator.ts`
- `src/common/guards/permissions.guard.ts`
- `src/common/guards/permissions.guard.spec.ts`
- `src/modules/roles/roles.module.ts`
- `src/modules/roles/roles.controller.ts`
- `src/modules/roles/roles.service.ts`
- `src/modules/roles/roles.service.spec.ts`
- `src/modules/roles/roles.exceptions.ts`
- `src/modules/roles/dto/*.ts`

**Modified files:**
- `prisma/schema.prisma`
- `src/app.module.ts`
- `src/common/exceptions/user-exceptions.ts` (or new `roles-exceptions.ts`)
- `src/common/exceptions/index.ts`

**Role CRUD endpoints:**

| Method | Path | Permission | Notes |
|--------|------|------------|-------|
| GET | `/api/roles` | `roles:read` | List all roles with permissions |
| GET | `/api/roles/:id` | `roles:read` | Get single role with permissions |
| POST | `/api/roles` | `roles:write` | Create role + assign permissions |
| PATCH | `/api/roles/:id` | `roles:write` | Update name/description + permissions |
| DELETE | `/api/roles/:id` | `roles:delete` | Delete role (fails if users assigned) |
| GET | `/api/permissions` | `roles:read` | List all defined permissions |

**PermissionsGuard logic:**
1. Skip if `@Public()` decorator is present (handled by JwtAuthGuard)
2. Extract `roleId` from `request.user` (set by JwtStrategy)
3. Query `RolePermission` where `roleId` matches
4. If any required permission is missing → throw `ForbiddenException`

### Step 2: Auth Integration + Role Assignment

**What you can do after this step:** Users register with default role, JWTs carry `roleId`, admins can change a user's role, end-to-end permission enforcement works.

**Modified files:**
- `src/modules/auth/strategies/jwt.strategy.ts` — return `{ userId, roleId }`
- `src/modules/auth/auth.service.ts` — assign default role on register; include roleId in JWT
- `src/modules/auth/auth.controller.ts` — add `PATCH /api/auth/users/:id/role`
- `src/modules/auth/dto/user-response.dto.ts` — add `role` field
- `src/modules/auth/auth.service.spec.ts` — update tests

## Out of Scope

- User management CRUD (list, view, update profile, delete users) — separate feature
- Swagger documentation — separate pass
- Row-level/resource-level permissions
- Role hierarchy / inheritance
- Permission caching beyond request lifecycle
- Admin protection for deleting the last admin role
