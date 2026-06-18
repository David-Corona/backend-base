import { ApiProperty } from '@nestjs/swagger';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import { AdminSessionResponseDto } from './admin-session-response.dto';

export class PaginatedAdminSessionsResponseDto
  implements PaginatedResponse<AdminSessionResponseDto>
{
  @ApiProperty({
    description: 'List of sessions with user details',
    type: [AdminSessionResponseDto],
  })
  data!: AdminSessionResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: 'object',
    properties: {
      total: { type: 'number', example: 10, description: 'Total number of sessions' },
      page: { type: 'number', example: 1, description: 'Current page number' },
      limit: { type: 'number', example: 25, description: 'Items per page' },
      totalPages: { type: 'number', example: 1, description: 'Total number of pages' },
    },
  })
  meta!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
