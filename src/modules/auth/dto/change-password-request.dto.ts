import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { IsPassword } from '@/common/decorators/is-password.decorator';

export class ChangePasswordRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @IsPassword()
  newPassword!: string;
}
