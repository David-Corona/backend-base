import { ApiProperty } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty({
    description: 'Role UUID',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id!: string;

  @ApiProperty({
    description: 'Role name',
    example: 'admin',
  })
  name!: string;

  @ApiProperty({
    description: 'Role description',
    example: 'Administrator role with full access',
    nullable: true,
  })
  description!: string | null;

  @ApiProperty({
    description: 'List of permission keys assigned to this role',
    type: [String],
    example: ['users:read', 'users:write'],
  })
  permissions!: string[];

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
