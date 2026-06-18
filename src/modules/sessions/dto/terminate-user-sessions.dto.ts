import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class TerminateUserSessionsDto {
  @ApiProperty({
    description: 'User UUID whose sessions to terminate',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    format: 'uuid',
  })
  @IsNotEmpty()
  @IsUUID()
  userId!: string;
}
