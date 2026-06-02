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
import { RoleResponseDto } from './dto/role-response.dto';
import { CreateRoleRequestDto } from './dto/create-role-request.dto';
import { UpdateRoleRequestDto } from './dto/update-role-request.dto';
import { PaginatedRolesResponseDto } from './dto/paginated-roles-response.dto';

export const GetRolesDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'List roles',
      description:
        'Returns a paginated list of all roles, sorted by creation date descending. Requires the `roles:read` permission.',
    }),
    ApiOkResponse({
      type: PaginatedRolesResponseDto,
      description: 'Paginated list of roles',
    }),
    ApiBadRequestResponse({
      description: 'VALIDATION_ERROR - Query parameter validation failed',
    }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires roles:read)',
    }),
  );

export const GetRoleByIdDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get role by ID',
      description:
        'Returns a single role by its UUID, including its assigned permissions. Requires the `roles:read` permission.',
    }),
    ApiParam({
      name: 'id',
      description: 'Role UUID',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    }),
    ApiOkResponse({ type: RoleResponseDto, description: 'Role found and returned' }),
    ApiNotFoundResponse({ description: 'ROLE_NOT_FOUND - Role not found' }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires roles:read)',
    }),
  );

export const CreateRoleDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Create role',
      description:
        'Creates a new role with the provided name, optional description, and list of permission keys. Requires the `roles:write` permission.',
    }),
    ApiBody({ type: CreateRoleRequestDto }),
    ApiCreatedResponse({ type: RoleResponseDto, description: 'Role created successfully' }),
    ApiBadRequestResponse({
      description:
        'VALIDATION_ERROR - Request body validation failed; INVALID_PERMISSIONS - One or more permissions do not exist',
    }),
    ApiConflictResponse({
      description: 'ROLE_ALREADY_EXISTS - Role with this name already exists',
    }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires roles:write)',
    }),
  );

export const UpdateRoleDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Update role',
      description:
        'Updates an existing role by ID. System roles (`admin`, `user`) cannot be renamed or have their permissions changed. Requires the `roles:write` permission.',
    }),
    ApiParam({
      name: 'id',
      description: 'Role UUID',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    }),
    ApiBody({ type: UpdateRoleRequestDto }),
    ApiOkResponse({ type: RoleResponseDto, description: 'Role updated successfully' }),
    ApiBadRequestResponse({
      description:
        'VALIDATION_ERROR - Request body validation failed; INVALID_PERMISSIONS - One or more permissions do not exist',
    }),
    ApiNotFoundResponse({ description: 'ROLE_NOT_FOUND - Role not found' }),
    ApiConflictResponse({
      description:
        'ROLE_ALREADY_EXISTS - Role with this name already exists; ROLE_PROTECTED - Cannot modify or delete a system role',
    }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires roles:write)',
    }),
  );

export const DeleteRoleDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Delete role',
      description:
        'Deletes a role by ID. System roles (`admin`, `user`) cannot be deleted. Roles assigned to users cannot be deleted. Requires the `roles:delete` permission.',
    }),
    ApiParam({
      name: 'id',
      description: 'Role UUID',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    }),
    ApiResponse({ status: 204, description: 'Role deleted successfully' }),
    ApiNotFoundResponse({ description: 'ROLE_NOT_FOUND - Role not found' }),
    ApiConflictResponse({
      description:
        'ROLE_PROTECTED - Cannot modify or delete a system role; ROLE_IN_USE - Cannot delete role while it is assigned to users',
    }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires roles:delete)',
    }),
  );
