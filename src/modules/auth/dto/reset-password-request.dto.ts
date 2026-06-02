import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { IsPassword } from '@/common/decorators/is-password.decorator';

export class ResetPasswordRequestDto {
  @ApiProperty({
    description: 'Password reset token received via email',
    example: 'a1b2c3d4e5f67890abcdef1234567890',
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token!: string;

  @ApiProperty({
    description: 'New password (must meet strength requirements)',
    example: 'NewSecureP@ss456',
    minLength: 8,
    maxLength: 128,
  })
  @IsPassword()
  newPassword!: string;
}
