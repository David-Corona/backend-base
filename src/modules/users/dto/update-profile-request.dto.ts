import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, ValidateIf } from 'class-validator';

export class UpdateProfileRequestDto {
  @ApiPropertyOptional({
    description:
      'New display name for the authenticated user. Pass `null` to clear the existing name. Omit to leave unchanged.',
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
