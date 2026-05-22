export class UserResponseDto {
  id!: string;
  email!: string;
  isVerified!: boolean;
  role!: {
    id: string;
    name: string;
  };
  createdAt!: Date;
}
