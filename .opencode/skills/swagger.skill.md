# Skill: Swagger Documentation

## Purpose
This skill defines how to add Swagger/OpenAPI documentation to endpoints in this project. Read this before documenting any endpoint.

---

## Core Rule

**Never write Swagger decorators directly inside a controller.**

Each controller has a companion `*.docs.ts` file that lives alongside it. All Swagger decorators go there, exported as individual decorators that are applied in the controller. The controller stays clean — one decorator per endpoint, nothing more.

---

## File Structure

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

---

## Decorator Pattern

### The docs file
```typescript
// users.docs.ts
import { applyDecorators } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
        'Returns a paginated list of all users. Requires the `users:read` permission.',
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
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token' }),
    ApiForbiddenResponse({ description: 'Insufficient permissions (requires users:read)' }),
  )

export const GetUserByIdDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get user by ID',
      description: 'Returns a single user by UUID. Requires the `users:read` permission.',
    }),
    ApiParam({
      name: 'id',
      description: 'User UUID',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    }),
    ApiOkResponse({ type: UserResponseDto, description: 'User found' }),
    ApiNotFoundResponse({ description: 'User not found' }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token' }),
    ApiForbiddenResponse({ description: 'Insufficient permissions (requires users:read)' }),
  )

export const CreateUserDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Create user',
      description: 'Creates a new user. Requires the `users:write` permission.',
    }),
    ApiBody({ type: CreateUserDto }),
    ApiCreatedResponse({ type: UserResponseDto, description: 'User created successfully' }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token' }),
    ApiForbiddenResponse({ description: 'Insufficient permissions (requires users:write)' }),
  )
```

### The controller
```typescript
// users.controller.ts
import { GetUsersDocs, GetUserByIdDocs, CreateUserDocs } from './users.docs'

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

---

## Requirements for Every Endpoint

Every endpoint decorator must include **all** of the following that apply:

| Decorator | When to include |
|-----------|----------------|
| `ApiBearerAuth()` | All protected endpoints |
| `ApiOperation` with `summary` + `description` | Always — description must mention the required permission |
| `ApiParam` | Every path parameter — include name, description, format, example |
| `ApiQuery` | Every query parameter — include name, required, type, description, example |
| `ApiBody` | All POST / PATCH endpoints — reference the request DTO type |
| `ApiOkResponse` | GET endpoints — reference the response DTO type |
| `ApiCreatedResponse` | POST endpoints that create a resource |
| `ApiNotFoundResponse` | Any endpoint with a `:id` param |
| `ApiUnauthorizedResponse` | All protected endpoints |
| `ApiForbiddenResponse` | All endpoints with permission requirements |

---

## DTOs Must Have ApiProperty

Every DTO property must have `@ApiProperty()` or `@ApiPropertyOptional()` with:
- `description` — what this field is
- `example` — a realistic example value
- `required` — explicit for optional fields

```typescript
export class CreateUserDto {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ description: 'Password (min 8 chars)', example: 'Str0ng!Pass' })
  @IsStrongPassword()
  password: string
}
```

---

## Naming Convention for Decorators

`PascalCase endpoint name + Docs`

- `GetUsersDocs`
- `GetUserByIdDocs`
- `CreateUserDocs`
- `UpdateUserDocs`
- `DeleteUserDocs`
- `LoginDocs`
- `RegisterDocs`
- `VerifyEmailDocs`

---

## Swagger Module Setup (main.ts)

```typescript
const config = new DocumentBuilder()
  .setTitle(appName)
  .setDescription(`${appName} API`)
  .setVersion('1.0')
  .addBearerAuth()
  .build()

const document = SwaggerModule.createDocument(app, config)
SwaggerModule.setup('api/docs', app, document)
```

Only set up in non-production environments unless explicitly required.
