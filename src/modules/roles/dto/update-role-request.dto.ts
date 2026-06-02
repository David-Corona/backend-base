import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ArrayMinSize, MinLength, MaxLength } from 'class-validator';

export class UpdateRoleRequestDto {
  @ApiPropertyOptional({
    description: 'Role name',
    example: 'editor',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Role description',
    example: 'Can edit and publish content',
    maxLength: 500,
    nullable: true,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'List of permission keys to assign to this role',
    type: [String],
    example: ['users:read', 'users:write'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(0)
  @IsOptional()
  permissions?: string[];
}
