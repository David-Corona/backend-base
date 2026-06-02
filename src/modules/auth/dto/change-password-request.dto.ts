import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { IsPassword } from '@/common/decorators/is-password.decorator';

export class ChangePasswordRequestDto {
  @ApiProperty({
    description: 'Current password for verification',
    example: 'SecureP@ss123',
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({
    description: 'New password (must meet strength requirements)',
    example: 'NewSecureP@ss456',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @IsPassword()
  newPassword!: string;
}
