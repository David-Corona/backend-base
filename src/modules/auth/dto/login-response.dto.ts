import { UserResponseDto } from '@/common/dto/user-response.dto';

export class LoginResponseDto {
  accessToken!: string;
  user!: UserResponseDto;
}
