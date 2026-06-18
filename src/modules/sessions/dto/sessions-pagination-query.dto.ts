import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean, MaxLength, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export class SessionsPaginationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter sessions by user ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
    required: false,
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter sessions by IP address (partial match)',
    example: '192.168.1',
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ip?: string;

  @ApiPropertyOptional({
    description: 'Filter sessions by user agent (partial match)',
    example: 'Mozilla/5.0',
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  userAgent?: string;

  @ApiPropertyOptional({
    description: 'Include expired sessions in results',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeExpired?: boolean = false;

  @ApiPropertyOptional({
    description: 'Filter sessions created after this date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  createdAfter?: string;

  @ApiPropertyOptional({
    description: 'Filter sessions created before this date (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  createdBefore?: string;
}
