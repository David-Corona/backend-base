import { IsEmail, IsString, IsOptional, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsPassword } from '@/common/decorators/is-password.decorator';

export class CreateUserRequestDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string;

  @IsPassword()
  password!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]{10,40}$/)
  roleId?: string;
}