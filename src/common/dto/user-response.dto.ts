export class UserResponseDto {
  id!: string;
  email!: string;
  name!: string | null;
  isActive!: boolean;
  isVerified!: boolean;
  role!: {
    id: string;
    name: string;
  };
  createdAt!: Date;
  updatedAt!: Date;
}