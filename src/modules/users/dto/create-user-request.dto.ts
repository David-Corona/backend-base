import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsPassword } from '@/common/decorators/is-password.decorator';

export class CreateUserRequestDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string;

  @ApiProperty({
    description: 'User password (must meet strength requirements)',
    example: 'Str0ng!Pass1',
    minLength: 8,
    maxLength: 128,
  })
  @IsPassword()
  password!: string;

  @ApiPropertyOptional({
    description: 'User display name (max 255 characters)',
    example: 'John Doe',
    maxLength: 255,
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description:
      'CUID of the role to assign. If omitted, the default `user` role is used.',
    example: 'clx0z2b3k0000a1b2c3d4e5f6',
    pattern: '^[a-z0-9-]{10,40}$',
    required: false,
  })
  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]{10,40}$/)
  roleId?: string;
}
