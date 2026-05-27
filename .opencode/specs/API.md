# API.md

Contract for all API responses.

---

## Response Shapes

### Single Resource
Return the DTO directly. No wrapper.

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "isVerified": true,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### List / Paginated
```json
{
  "data": [ /* resource DTOs */ ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Empty Success (e.g. logout, delete)
HTTP `204 No Content`, no body.

### Confirmation Success (e.g. verify email, reset password)
HTTP `200 OK` with `{ "message": "..." }`.

---

## Error Shape

```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "User not found",
  "code": "USER_NOT_FOUND"
}
```

- `statusCode` — mirrors HTTP status
- `error` — human-readable status label
- `message` — what went wrong
- `code` — machine-readable, `SCREAMING_SNAKE_CASE`

Never expose stack traces, Prisma errors, or internals.

---

## Pagination

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `page` | number | 1 | 1-indexed |
| `limit` | number | 25 | max 100 |

## Timestamps

ISO 8601 UTC: `2024-01-01T00:00:00.000Z`. 

## HTTP Status Codes

Standard semantics. Two that get misused:
- Delete/logout → **`204`**, not `200`.
- Conflict (duplicate email, unique key) → **`409`**, not `400`.