import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { IsPassword } from '@/common/decorators/is-password.decorator';

export class RegisterRequestDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string;

  @ApiProperty({
    description: 'User password (must meet strength requirements)',
    example: 'SecureP@ss123',
    minLength: 8,
    maxLength: 128,
  })
  @IsPassword()
  password!: string;
}
