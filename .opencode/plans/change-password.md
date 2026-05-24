# Improve Password Validation + Logged-in Password Reset

## Goal

Enforce stronger password rules (8+ chars, uppercase, lowercase, digit) via a reusable custom decorator, and add `POST /api/auth/change-password` requiring current password verification.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Validation rules | 8+ chars, uppercase, lowercase, digit | Simple, no deps, covers OWASP basics |
| Validation location | Custom `@IsPassword()` decorator | Reusable, clean DTOs, follows existing pattern |
| Endpoint | `POST /api/auth/change-password` | Separate concern from public token-based reset |
| Current password check | Required | OWASP best practice for credential changes |
| Session invalidation | None | Separate feature; password change alone doesn't need it |
| Email notification | Not needed | Low-value for this flow |
| Password history | Not implemented | Out of scope |

## Files

| File | Action |
|---|---|
| `src/common/decorators/is-password.decorator.ts` | Create — `@IsPassword()` validator |
| `src/modules/auth/dto/change-password-request.dto.ts` | Create — `currentPassword` + `newPassword` |
| `src/modules/auth/auth.exceptions.ts` | Add — `InvalidPasswordException` |
| `src/modules/auth/auth.service.ts` | Add — `changePassword(userId, currentPassword, newPassword)` |
| `src/modules/auth/auth.controller.ts` | Add — `POST change-password` endpoint |
| `src/modules/auth/dto/register-request.dto.ts` | Update — use `@IsPassword()` |
| `src/modules/auth/auth.service.spec.ts` | Update — add tests |
| `test/auth.e2e-spec.ts` | Update — add e2e tests |

## Flow

1. Controller receives `{ currentPassword, newPassword }` with JWT user
2. Service finds user by `userId`
3. `bcrypt.compare(currentPassword, user.password)` — throws `InvalidPasswordException` on mismatch
4. `bcrypt.hash(newPassword, 12)` — update user
5. Return `{ message: "Password changed successfully" }`
