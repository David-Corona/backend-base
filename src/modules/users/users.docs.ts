import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserResponseDto } from '@/common/dto/user-response.dto';
import { CreateUserRequestDto } from './dto/create-user-request.dto';
import { UpdateUserRequestDto } from './dto/update-user-request.dto';
import { UpdateProfileRequestDto } from './dto/update-profile-request.dto';
import { AssignRoleRequestDto } from './dto/assign-role-request.dto';
import { PaginatedUsersResponseDto } from './dto/paginated-users-response.dto';

export const GetUsersDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'List users',
      description:
        'Returns a paginated list of users, sorted by creation date descending. Supports filtering by account status and partial-match search by name or email. Requires the `users:read` permission.',
    }),
    ApiOkResponse({
      type: PaginatedUsersResponseDto,
      description: 'Paginated list of users',
    }),
    ApiBadRequestResponse({
      description: 'VALIDATION_ERROR - Query parameter validation failed',
    }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires users:read)',
    }),
  );

export const GetMeDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get current user',
      description: 'Returns the authenticated user profile.',
    }),
    ApiOkResponse({ type: UserResponseDto, description: 'Current user profile' }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiNotFoundResponse({
      description: 'USER_NOT_FOUND - User not found',
    }),
  );

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
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires users:read)',
    }),
    ApiNotFoundResponse({
      description: 'USER_NOT_FOUND - User not found',
    }),
  );

export const CreateUserDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Create user',
      description:
        'Creates a new user with the provided email, password, and optional name and role. If `roleId` is omitted, the default `user` role is assigned. The new account is created as verified and active. Requires the `users:write` permission.',
    }),
    ApiBody({ type: CreateUserRequestDto }),
    ApiCreatedResponse({ type: UserResponseDto, description: 'User created successfully' }),
    ApiBadRequestResponse({
      description: 'VALIDATION_ERROR - Request body validation failed',
    }),
    ApiConflictResponse({
      description: 'USER_ALREADY_EXISTS - A user with this email already exists',
    }),
    ApiNotFoundResponse({
      description: 'ROLE_NOT_FOUND - The specified role does not exist',
    }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires users:write)',
    }),
  );

export const UpdateMeDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update current user',
      description:
        'Updates the authenticated user profile. Currently only the display name can be changed. Pass `name: null` to clear the existing name; omit the field to leave it unchanged.',
    }),
    ApiBody({ type: UpdateProfileRequestDto }),
    ApiOkResponse({ type: UserResponseDto, description: 'Profile updated successfully' }),
    ApiBadRequestResponse({
      description: 'VALIDATION_ERROR - Request body validation failed',
    }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiNotFoundResponse({
      description: 'USER_NOT_FOUND - User not found',
    }),
  );

export const UpdateUserDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update user',
      description:
        'Updates an existing user by ID. Currently only the display name can be changed. Pass `name: null` to clear the existing name; omit the field to leave it unchanged. Requires the `users:write` permission.',
    }),
    ApiParam({
      name: 'id',
      description: 'User UUID',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    }),
    ApiBody({ type: UpdateUserRequestDto }),
    ApiOkResponse({ type: UserResponseDto, description: 'User updated successfully' }),
    ApiBadRequestResponse({
      description: 'VALIDATION_ERROR - Request body validation failed',
    }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires users:write)',
    }),
    ApiNotFoundResponse({
      description: 'USER_NOT_FOUND - User not found',
    }),
  );

export const DeactivateUserDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Deactivate user',
      description:
        'Deactivates a user account and terminates all of its sessions in a single transaction. Cannot be used to deactivate the authenticated user own account. Requires the `users:delete` permission.',
    }),
    ApiParam({
      name: 'id',
      description: 'User UUID',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    }),
    ApiResponse({ status: 204, description: 'User deactivated successfully' }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description:
        'PERMISSION_DENIED - Insufficient permissions (requires users:delete); CANNOT_DEACTIVATE_SELF - You cannot deactivate your own account',
    }),
    ApiNotFoundResponse({
      description: 'USER_NOT_FOUND - User not found',
    }),
  );

export const ActivateUserDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Activate user',
      description:
        'Reactivates a previously deactivated user account. Requires the `users:write` permission.',
    }),
    ApiParam({
      name: 'id',
      description: 'User UUID',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    }),
    ApiOkResponse({ type: UserResponseDto, description: 'User activated successfully' }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires users:write)',
    }),
    ApiNotFoundResponse({
      description: 'USER_NOT_FOUND - User not found',
    }),
  );

export const AssignRoleDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Assign role to user',
      description:
        'Assigns a role to an existing user. Requires the `users:assign-role` permission.',
    }),
    ApiParam({
      name: 'id',
      description: 'User UUID',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    }),
    ApiBody({ type: AssignRoleRequestDto }),
    ApiOkResponse({ type: UserResponseDto, description: 'Role assigned successfully' }),
    ApiBadRequestResponse({
      description: 'VALIDATION_ERROR - Request body validation failed',
    }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description:
        'PERMISSION_DENIED - Insufficient permissions (requires users:assign-role)',
    }),
    ApiNotFoundResponse({
      description: 'USER_NOT_FOUND - User not found; ROLE_NOT_FOUND - Role not found',
    }),
  );
