export class SessionResponseDto {
  id!: string;
  isCurrent!: boolean;
  userAgent!: string | null;
  ip!: string | null;
  expiresAt!: Date;
  createdAt!: Date;
  updatedAt!: Date;
}
