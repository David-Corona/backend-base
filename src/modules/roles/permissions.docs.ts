import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PaginatedPermissionsResponseDto } from './dto/paginated-permissions-response.dto';

export const GetPermissionsDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'List permissions',
      description:
        'Returns a paginated list of all permissions, sorted by key ascending. Requires the `roles:read` permission.',
    }),
    ApiOkResponse({
      type: PaginatedPermissionsResponseDto,
      description: 'Paginated list of permissions',
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
