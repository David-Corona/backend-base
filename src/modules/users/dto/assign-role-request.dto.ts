import { IsString, Matches } from 'class-validator';

export class AssignRoleRequestDto {
  @IsString()
  @Matches(/^[a-z0-9-]{10,40}$/)
  roleId!: string;
}