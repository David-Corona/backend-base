import { ApiProperty } from '@nestjs/swagger';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import { SessionResponseDto } from '@/common/dto/session-response.dto';

export class PaginatedUserSessionsResponseDto
  implements PaginatedResponse<SessionResponseDto>
{
  @ApiProperty({
    description: 'List of sessions for the user',
    type: [SessionResponseDto],
  })
  data!: SessionResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: 'object',
    properties: {
      total: { type: 'number', example: 3, description: 'Total number of sessions' },
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
