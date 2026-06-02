import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class AssignRoleRequestDto {
  @ApiProperty({
    description: 'CUID of the role to assign to the user',
    example: 'clx0z2b3k0000a1b2c3d4e5f6',
    pattern: '^[a-z0-9-]{10,40}$',
  })
  @IsString()
  @Matches(/^[a-z0-9-]{10,40}$/)
  roleId!: string;
}
