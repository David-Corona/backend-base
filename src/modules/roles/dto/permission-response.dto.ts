import { ApiProperty } from '@nestjs/swagger';

export class PermissionResponseDto {
  @ApiProperty({
    description: 'Permission UUID',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id!: string;

  @ApiProperty({
    description: 'Permission key in resource:action format',
    example: 'users:read',
  })
  key!: string;

  @ApiProperty({
    description: 'Human-readable permission name',
    example: 'Read Users',
  })
  name!: string;

  @ApiProperty({
    description: 'Permission description',
    example: 'Allows reading user data',
    nullable: true,
  })
  description!: string | null;

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
