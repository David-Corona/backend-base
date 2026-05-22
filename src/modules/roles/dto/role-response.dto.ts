export class RoleResponseDto {
  id!: string;
  name!: string;
  description!: string | null;
  permissions!: string[];
  createdAt!: Date;
  updatedAt!: Date;
}
