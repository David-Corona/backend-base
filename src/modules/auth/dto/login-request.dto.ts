import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginRequestDto {
  @IsEmail()
  @Transform(({ value }: { value: string }) => value?.toLowerCase().trim())
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
