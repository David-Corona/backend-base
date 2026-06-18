import { ApiProperty } from '@nestjs/swagger';

export class AdminSessionResponseDto {
  @ApiProperty({
    description: 'Session UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    description: 'User who owns this session',
    type: 'object',
    properties: {
      id: { type: 'string', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', format: 'uuid' },
      email: { type: 'string', example: 'user@example.com' },
      name: { type: 'string', example: 'John Doe', nullable: true },
    },
  })
  user!: { id: string; email: string; name: string | null };

  @ApiProperty({
    description: 'User agent string from the client',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    nullable: true,
    required: false,
  })
  userAgent!: string | null;

  @ApiProperty({
    description: 'Client IP address',
    example: '192.168.1.100',
    nullable: true,
    required: false,
  })
  ip!: string | null;

  @ApiProperty({
    description: 'Whether this session is expired',
    example: false,
  })
  isExpired!: boolean;

  @ApiProperty({
    description: 'Session expiration timestamp',
    example: '2024-01-08T00:00:00.000Z',
  })
  expiresAt!: Date;

  @ApiProperty({
    description: 'Session creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  updatedAt!: Date;
}
