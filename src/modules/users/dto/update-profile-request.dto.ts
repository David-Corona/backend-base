import { IsString, IsOptional, MaxLength, ValidateIf } from 'class-validator';

export class UpdateProfileRequestDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(255)
  name?: string | null;
}
