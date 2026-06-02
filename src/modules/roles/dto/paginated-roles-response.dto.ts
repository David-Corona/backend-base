import { ApiProperty } from '@nestjs/swagger';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import { RoleResponseDto } from './role-response.dto';

export class PaginatedRolesResponseDto implements PaginatedResponse<RoleResponseDto> {
  @ApiProperty({
    description: 'List of roles',
    type: [RoleResponseDto],
  })
  data!: RoleResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: 'object',
    properties: {
      total: { type: 'number', example: 100, description: 'Total number of roles' },
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
