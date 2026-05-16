# API.md

Defines the contract for all API responses. Every endpoint must follow these shapes without exception. Consistency here is non-negotiable — clients depend on predictable response structures.

---

## Base URL

All endpoints are prefixed with `/api`.

---

## Response Shapes

### Single Resource
Return the DTO directly. No wrapper envelope.

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "isVerified": true,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### List / Paginated Resource
Paginated responses always use this envelope:

```json
{
  "data": [ ...array of resource DTOs... ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Empty Success (e.g. logout, delete)
Return HTTP `204 No Content` with no body.

---

## Error Shape

All errors return this shape, always. The global exception filter is responsible for this — never construct error responses manually.

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "User not found",
  "code": "USER_NOT_FOUND"
}
```

- `statusCode` — HTTP status code (mirrors the HTTP status)
- `error` — human-readable HTTP status label
- `message` — human-readable description of what went wrong
- `code` — machine-readable error code for client-side handling, `SCREAMING_SNAKE_CASE`

Never expose stack traces, Prisma errors, or internal details in error responses.

---

## Pagination

Query parameters for paginated endpoints:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number, 1-indexed |
| `limit` | number | 20 | Items per page, max 100 |

---

## Timestamps

All timestamps are returned in **ISO 8601 UTC** format: `2024-01-01T00:00:00.000Z`.
Never return Unix timestamps or locale-formatted dates.

---

## Naming Conventions

- JSON keys: `camelCase`
- URL paths: `kebab-case` — `/api/auth/reset-password`
- URL path parameters: `camelCase` — `/api/users/:userId`
- Query parameters: `camelCase` — `?sortBy=createdAt`
- Boolean fields: prefixed with `is` or `has` — `isVerified`, `isActive`
- Timestamp fields: suffixed with `At` — `createdAt`, `updatedAt`, `expiresAt`

---

## HTTP Status Codes

Use the correct code — do not return `200` for everything.

| Scenario | Code |
|----------|------|
| Successful read | 200 |
| Successful create | 201 |
| Successful delete / logout | 204 |
| Validation failed | 400 |
| Unauthenticated | 401 |
| Authenticated but forbidden | 403 |
| Resource not found | 404 |
| Conflict (e.g. email exists) | 409 |
| Server error | 500 |

---

## Auth Headers

Protected endpoints require a Bearer token:

```
Authorization: Bearer <access_token>
```

Refresh tokens are passed via HTTP-only cookie, not headers or body.
