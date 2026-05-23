import { IsString, IsOptional, MaxLength } from 'class-validator';

/** Admin-only DTO for updating another user's profile. Kept separate from
 *  UpdateProfileRequestDto so the two can diverge in the future. */
export class UpdateUserRequestDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;
}