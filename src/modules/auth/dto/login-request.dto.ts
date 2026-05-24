import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';
import { IsPassword } from '@/common/decorators/is-password.decorator';

export class LoginRequestDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string;

  @IsString()
  @IsPassword()
  password!: string;
}
