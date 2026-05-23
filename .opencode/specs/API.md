# API.md

Defines the contract for all API responses. Every endpoint must follow these shapes without exception. Consistency here is non-negotiable — clients depend on predictable response structures.

All endpoints are prefixed with `/api`. For naming conventions (JSON keys, URL paths, query parameters, boolean and timestamp fields), see `architecture.md`.

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
  "data": [ /* array of resource DTOs */ ],
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

### Confirmation Success (e.g. verify email, reset password)
When user-facing feedback is useful, return HTTP `200 OK` with a minimal `{ message }` body:

```json
{
  "message": "Email verified successfully"
}
```

---

## Error Shape

All errors return this shape, always. The global exception filter is the only place that constructs error responses — controllers and services must never build them manually.

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
| `limit` | number | 25 | Items per page, max 100 |

---

## Timestamps

All timestamps are returned in **ISO 8601 UTC** format: `2024-01-01T00:00:00.000Z`. Never return Unix timestamps or locale-formatted dates.

---

## HTTP Status Codes

Use the correct code — do not return `200` for everything. Standard HTTP semantics apply. Two cases that get misused and are worth calling out explicitly:

- Successful delete or logout → **`204 No Content`**, not `200`.
- Resource conflict (e.g. email already exists, duplicate unique key) → **`409 Conflict`**, not `400`.

---

## Auth Headers

Protected endpoints require a Bearer token:

```
Authorization: Bearer <access_token>
```

Refresh tokens are passed via HTTP-only cookie, never via headers or request body.