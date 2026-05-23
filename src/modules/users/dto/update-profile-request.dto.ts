import { IsString, IsOptional, MaxLength } from 'class-validator';

/** Self-service DTO for a user updating their own profile.
 *  Currently mirrors UpdateUserRequestDto but kept separate for future divergence. */
export class UpdateProfileRequestDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;
}