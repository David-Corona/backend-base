import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: 'User UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email!: string;

  @ApiProperty({
    description: 'User display name',
    example: 'John Doe',
    nullable: true,
    required: false,
  })
  name!: string | null;

  @ApiProperty({
    description: 'Whether the user account is active',
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: 'Whether the user email has been verified',
    example: true,
  })
  isVerified!: boolean;

  @ApiProperty({
    description: 'User role',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', format: 'uuid' },
      name: { type: 'string', example: 'user' },
    },
  })
  role!: {
    id: string;
    name: string;
  };

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt!: Date;
}