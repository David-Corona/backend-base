import { ApiProperty } from '@nestjs/swagger';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import { PermissionResponseDto } from './permission-response.dto';

export class PaginatedPermissionsResponseDto implements PaginatedResponse<PermissionResponseDto> {
  @ApiProperty({
    description: 'List of permissions',
    type: [PermissionResponseDto],
  })
  data!: PermissionResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: 'object',
    properties: {
      total: { type: 'number', example: 100, description: 'Total number of permissions' },
      page: { type: 'number', example: 1, description: 'Current page number' },
      limit: { type: 'number', example: 25, description: 'Items per page' },
      totalPages: { type: 'number', example: 4, description: 'Total number of pages' },
    },
  })
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
