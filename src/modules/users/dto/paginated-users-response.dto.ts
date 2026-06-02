import { ApiProperty } from '@nestjs/swagger';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import { UserResponseDto } from '@/common/dto/user-response.dto';

export class PaginatedUsersResponseDto implements PaginatedResponse<UserResponseDto> {
  @ApiProperty({
    description: 'List of users',
    type: [UserResponseDto],
  })
  data!: UserResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: 'object',
    properties: {
      total: { type: 'number', example: 100, description: 'Total number of users' },
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
