import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { UnauthorizedException } from '@/common/exceptions';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; roleId: string; sid: string; permissions: string[] }): Promise<{ userId: string; roleId: string; sessionId: string; permissions: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, roleId: true },
    });

    if (!user) {
      throw new UnauthorizedException('USER_NOT_FOUND', 'User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('ACCOUNT_INACTIVE', 'Account is inactive');
    }

    return { userId: user.id, roleId: user.roleId, sessionId: payload.sid, permissions: payload.permissions };
  }
}
