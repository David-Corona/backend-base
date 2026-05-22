import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginRequestDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
