import { IsString, IsOptional, IsArray, ArrayMinSize, MinLength, MaxLength } from 'class-validator';

export class CreateRoleRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string | null;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(0)
  permissions!: string[];
}
