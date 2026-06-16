import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class RoleDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;
}

export class UserResponseDto {
  @ApiProperty({
    description: 'User UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @Expose()
  id!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @Expose()
  email!: string;

  @ApiProperty({
    description: 'User display name',
    example: 'John Doe',
    nullable: true,
    required: false,
  })
  @Expose()
  name!: string | null;

  @ApiProperty({
    description: 'Whether the user account is active',
    example: true,
  })
  @Expose()
  isActive!: boolean;

  @ApiProperty({
    description: 'Whether the user email has been verified',
    example: true,
  })
  @Expose()
  isVerified!: boolean;

  @ApiProperty({
    description: 'User role',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', format: 'uuid' },
      name: { type: 'string', example: 'user' },
    },
  })
  @Expose()
  @Type(() => RoleDto)
  role!: RoleDto;

  @ApiProperty({
    description: 'User permission keys',
    example: ['users:read', 'roles:read'],
    type: [String],
    isArray: true,
  })
  @Expose()
  permissions!: string[];

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Expose()
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Expose()
  updatedAt!: Date;
}