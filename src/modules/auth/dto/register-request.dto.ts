import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';
import { IsPassword } from '@/common/decorators/is-password.decorator';

export class RegisterRequestDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string;

  @IsPassword()
  password!: string;
}
