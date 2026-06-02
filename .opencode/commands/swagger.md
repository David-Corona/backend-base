---
description: Generate or update Swagger/OpenAPI docs for a controller or endpoint
agent: build
---

Generate or update Swagger decorator documentation based on `$ARGUMENTS`.

The argument determines scope — e.g.:
- `auth controller` or `auth` — full `auth.docs.ts`, all DTOs it touches
- `login endpoint` or `auth login` — just the login endpoint's decorator and its DTOs
- `all` — every module

If scope is unclear, default to the controller named in `$ARGUMENTS`. If no controller matches, list candidates and stop.

## Before writing

Read `.opencode/specs/API.md` (response shapes, error shape, pagination, status codes) and `.opencode/specs/ARCHITECTURE.md` (naming conventions, layering, `@Public()` / `@RequirePermissions()` usage). Then read the target controller, the service method each endpoint calls, every DTO referenced, and any existing `.docs.ts`.

## Core rule

Never write Swagger decorators inside a controller. Each controller has a companion `*.docs.ts` file alongside it holding all decorators, exported one per endpoint and applied in the controller. The controller stays clean — one docs decorator per method, nothing more.

```
src/modules/users/
  users.controller.ts     ← clean, imports from users.docs.ts
  users.docs.ts           ← all swagger decorators live here
  users.service.ts
  users.module.ts
  dto/
    create-user.dto.ts
    update-user.dto.ts
    user-response.dto.ts
```

## What to do

### 1. Add `@ApiTags` to the controller class
One `@ApiTags(...)` per controller, matching the module's display name (`AuthController` → `@ApiTags('Auth')`, `UsersController` → `@ApiTags('Users')`). Skip if already present.

### 2. Add `@ApiProperty` / `@ApiPropertyOptional` to DTOs
Every DTO property the target endpoint(s) reference must have `@ApiProperty()` or `@ApiPropertyOptional()` with `description`, `example`, and explicit `required` for optional fields. Covers request DTOs, response DTOs, and paginated response DTOs. Check first — don't add duplicates.

### 3. Create or update the `.docs.ts`
One exported `applyDecorators` function per endpoint, named with a descriptive PascalCase name based on the endpoint's purpose followed by `Docs` — not the controller method name (e.g. `findAll` → `GetUsersDocs`, `findOne` → `GetUserByIdDocs`, `create` → `CreateUserDocs`, `login` → `LoginDocs`, `verifyEmail` → `VerifyEmailDocs`). Reference real DTO types for bodies and responses — never inline a schema where a DTO exists. For paginated endpoints, create or reuse a concrete `PaginatedXxxResponseDto` extending `PaginatedResponse<...>` — never use the generic `PaginatedResponse<T>` directly in a decorator. If Swagger cannot resolve the generic envelope (i.e. the response shows `$ref` to a generic instead of the full schema), add `@ApiExtraModels(PaginatedXxxResponseDto)` on the controller class and reference it with `getSchemaPath(PaginatedXxxResponseDto)` inside the decorator. Error responses match the API error shape; success responses match the API response shapes (single DTO, paginated envelope, 204, or `{ message }`).

```typescript
// users.docs.ts
import { applyDecorators } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { CreateUserDto } from './dto/create-user.dto'
import { UserResponseDto } from './dto/user-response.dto'
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto'

export const GetUsersDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'List users',
      description:
        'Returns a paginated list of all users, sorted by creation date descending. Supports searching by email with partial matching. Requires the `users:read` permission.',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number (1-indexed)',
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Items per page (max 100)',
      example: 20,
    }),
    ApiQuery({
      name: 'search',
      required: false,
      type: String,
      description: 'Filter users by email (partial match)',
    }),
    ApiOkResponse({
      type: PaginatedUsersResponseDto,
      description: 'Paginated list of users',
    }),
    ApiUnauthorizedResponse({
      description: 'AUTH_REQUIRED - Authentication required',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires users:read)',
    }),
  )

export const GetUserByIdDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get user by ID',
      description:
        'Returns a single user by their UUID. Requires the `users:read` permission.',
    }),
    ApiParam({
      name: 'id',
      description: 'User UUID',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    }),
    ApiOkResponse({ type: UserResponseDto, description: 'User found and returned' }),
    ApiNotFoundResponse({ description: 'USER_NOT_FOUND - User not found' }),
    ApiUnauthorizedResponse({ description: 'AUTH_REQUIRED - Authentication required' }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires users:read)',
    }),
  )

export const CreateUserDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Create user',
      // description claims are traced from UsersService.create — read the service, don't assume
      description:
        'Creates a new user with the provided email, password, and role. Requires the `users:write` permission.',
    }),
    ApiBody({ type: CreateUserDto }),
    ApiCreatedResponse({ type: UserResponseDto, description: 'User created successfully' }),
    // source 3: ValidationPipe on CreateUserDto
    ApiBadRequestResponse({ description: 'Validation failed on request body' }),
    // source 1: traced from UsersService.create
    ApiConflictResponse({
      description: 'USER_ALREADY_EXISTS - A user with this email already exists',
    }),
    // source 1: traced from UsersService.create → RolesService.findOne
    ApiNotFoundResponse({
      description: 'ROLE_NOT_FOUND - The specified role does not exist',
    }),
    // source 2: auth guard / @RequirePermissions('users:write')
    ApiUnauthorizedResponse({ description: 'AUTH_REQUIRED - Authentication required' }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires users:write)',
    }),
  )
```

```typescript
// users.controller.ts
import { GetUsersDocs, GetUserByIdDocs, CreateUserDocs } from './users.docs'

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @GetUsersDocs()
  findAll(@Query() query: PaginatedQueryDto) {
    return this.usersService.findAll(query)
  }

  @Get(':id')
  @GetUserByIdDocs()
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id)
  }

  @Post()
  @CreateUserDocs()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto)
  }
}
```

### Decorator requirements

Exceptions reach the client from three sources — you must trace all of them:

1. **The service method and its transitive calls.** Read the method body, then follow every `private` method it calls and every call to injected services. Do not stop at depth one — a helper that calls another helper that throws `InvalidTokenException` must still be found and documented.
2. **Guards on the route.** `@RequirePermissions()` throws `ForbiddenException`; the auth guard throws `UnauthorizedException`. These run before the service, so even `@Public()` endpoints may throw if they have different guards.
3. **The ValidationPipe.** Any endpoint with a request DTO can return `400` with validation errors. Add `ApiBadRequestResponse` for all POST / PATCH endpoints that accept a body.

Document each exception with its code and message (e.g. `'USER_NOT_FOUND - User not found'`, `'INVALID_CREDENTIALS - Invalid email or password'`). When multiple exceptions share the same status code, combine them in one decorator listing all variants, separated by semicolons: `ApiNotFoundResponse({ description: 'USER_NOT_FOUND - User not found; ROLE_NOT_FOUND - Role not found' })`. Map status codes to Swagger decorators: `400` → `ApiBadRequestResponse`, `401` → `ApiUnauthorizedResponse`, `403` → `ApiForbiddenResponse`, `404` → `ApiNotFoundResponse`, `409` → `ApiConflictResponse`.

Include every one of these that applies to the endpoint:

| Decorator | When to include |
|-----------|----------------|
| `ApiOperation` (`summary` + `description`) | Always. `summary` is short. `description` is complete but verifiable — cover what the code actually does, no more. Do not infer behavior, business rules, or side effects that aren't explicitly in the source. |
| `ApiBearerAuth()` | All token-protected endpoints |
| `ApiCookieAuth('refresh_token')` | Refresh-token endpoints (cookie-based) |
| `ApiParam` | Every path parameter — name, description, format, example |
| `ApiQuery` | Every query parameter — name, required, type, description, example |
| `ApiBody` | All POST / PATCH endpoints — reference the request DTO |
| `ApiOkResponse` | GET and other `200` endpoints — reference the response DTO |
| `ApiCreatedResponse` | POST endpoints that create a resource — reference the response DTO |
| `ApiXxxResponse` (by status code) | Every exception found in sources 1–3 above — map its `statusCode` to the matching decorator |

Cases the table doesn't spell out:
- `@Public()` endpoints: no `@ApiBearerAuth()`, and no `ApiUnauthorizedResponse` / `ApiForbiddenResponse` unless the endpoint itself can return them.
- 204 No Content (logout, delete): `@ApiResponse({ status: 204, description: '...' })`, no body.
- `{ message }` responses (verify email, reset password): `@ApiOkResponse` with an inline schema plus an example:
  ```typescript
  ApiOkResponse({
    schema: {
      properties: { message: { type: 'string', example: 'Email verified successfully' } },
    },
    description: 'EMAIL_VERIFIED - Email verified successfully',
  })
  ```

When updating a single endpoint: replace only that endpoint's function in the existing `.docs.ts`, leave the rest untouched. When updating a whole controller: rewrite the full `.docs.ts`.

### 4. Wire decorators into the controller
Import each docs decorator and apply it to its method, above all other decorators. Don't duplicate if already present. Don't touch existing decorators or logic.

### 5. Verify
Run `npx tsc --noEmit` and fix any type errors. Do not start the server, do not commit.