import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export enum UserStatusFilter {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ALL = 'all',
}

export class UsersPaginationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter users by account status',
    enum: UserStatusFilter,
    default: UserStatusFilter.ACTIVE,
    example: UserStatusFilter.ACTIVE,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserStatusFilter)
  status?: UserStatusFilter = UserStatusFilter.ACTIVE;

  @ApiPropertyOptional({
    description: 'Filter users by display name (case-insensitive partial match)',
    example: 'John',
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Filter users by email (case-insensitive partial match)',
    example: 'user@example.com',
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;
}
