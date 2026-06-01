import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from '@/common/dto/user-response.dto';

export class LoginResponseDto {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Authenticated user profile',
    type: () => UserResponseDto,
  })
  user!: UserResponseDto;
}
