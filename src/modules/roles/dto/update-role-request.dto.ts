import { IsString, IsOptional, IsArray, ArrayMinSize, MinLength, MaxLength } from 'class-validator';

export class UpdateRoleRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(0)
  @IsOptional()
  permissions?: string[];
}
