import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class VerifyEmailRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token!: string;
}
