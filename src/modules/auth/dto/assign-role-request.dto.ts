import { IsString } from 'class-validator';

export class AssignRoleRequestDto {
  @IsString()
  roleId!: string;
}
