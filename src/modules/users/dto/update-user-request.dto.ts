import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, ValidateIf } from 'class-validator';

export class UpdateUserRequestDto {
  @ApiPropertyOptional({
    description:
      'New user display name. Pass `null` to clear the existing name. Omit to leave unchanged.',
    example: 'John Doe',
    maxLength: 255,
    nullable: true,
    required: false,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(255)
  name?: string | null;
}
