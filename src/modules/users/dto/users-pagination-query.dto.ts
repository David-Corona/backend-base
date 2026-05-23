import { IsOptional, IsEnum } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export enum UserStatusFilter {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ALL = 'all',
}

export class UsersPaginationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(UserStatusFilter)
  status?: UserStatusFilter = UserStatusFilter.ACTIVE;
}