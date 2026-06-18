import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PaginatedAdminSessionsResponseDto } from './dto/paginated-admin-sessions-response.dto';
import { AdminSessionResponseDto } from './dto/admin-session-response.dto';

export const ListAllSessionsDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'List all sessions',
      description:
        'Returns a paginated list of all sessions across all users. Supports filtering by user ID, IP address, user agent, expiration status, and creation date range. Requires the `sessions:read` permission.',
    }),
    ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID (UUID)', format: 'uuid' }),
    ApiQuery({ name: 'ip', required: false, description: 'Filter by IP address (partial match)' }),
    ApiQuery({ name: 'userAgent', required: false, description: 'Filter by user agent (partial match)' }),
    ApiQuery({ name: 'includeExpired', required: false, description: 'Include expired sessions', type: Boolean }),
    ApiQuery({ name: 'createdAfter', required: false, description: 'Filter sessions created after this date (ISO 8601)' }),
    ApiQuery({ name: 'createdBefore', required: false, description: 'Filter sessions created before this date (ISO 8601)' }),
    ApiOkResponse({
      type: PaginatedAdminSessionsResponseDto,
      description: 'Paginated list of sessions',
    }),
    ApiBadRequestResponse({
      description: 'VALIDATION_ERROR - Query parameter validation failed',
    }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires sessions:read)',
    }),
  );

export const GetSessionByIdDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Get session by ID',
      description:
        'Returns a single session with user details. Requires the `sessions:read` permission.',
    }),
    ApiParam({
      name: 'id',
      description: 'Session UUID',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    }),
    ApiOkResponse({ type: AdminSessionResponseDto, description: 'Session found and returned' }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires sessions:read)',
    }),
    ApiNotFoundResponse({
      description: 'SESSION_NOT_FOUND - Session not found',
    }),
  );

export const TerminateSessionDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Terminate a session',
      description:
        'Terminates any session by ID, regardless of which user it belongs to. Requires the `sessions:terminate` permission.',
    }),
    ApiParam({
      name: 'id',
      description: 'Session UUID',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    }),
    ApiResponse({ status: 204, description: 'Session terminated successfully' }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires sessions:terminate)',
    }),
    ApiNotFoundResponse({
      description: 'SESSION_NOT_FOUND - Session not found',
    }),
  );

export const TerminateUserSessionsDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Terminate all sessions for a user',
      description:
        'Terminates all active sessions belonging to the specified user. Requires the `sessions:terminate` permission.',
    }),
    ApiQuery({
      name: 'userId',
      required: true,
      description: 'User UUID whose sessions to terminate',
      format: 'uuid',
    }),
    ApiResponse({ status: 204, description: 'All user sessions terminated successfully' }),
    ApiBadRequestResponse({
      description: 'VALIDATION_ERROR - Query parameter validation failed',
    }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; UNAUTHORIZED - Invalid or expired token; USER_NOT_FOUND - User not found; ACCOUNT_INACTIVE - Account is inactive',
    }),
    ApiForbiddenResponse({
      description: 'PERMISSION_DENIED - Insufficient permissions (requires sessions:terminate)',
    }),
  );
