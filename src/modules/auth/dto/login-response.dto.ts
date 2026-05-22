import { UserResponseDto } from './user-response.dto';

export class LoginResponseDto {
  accessToken!: string;
  user!: UserResponseDto;
}
