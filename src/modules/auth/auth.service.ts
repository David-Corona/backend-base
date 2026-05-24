import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Logger } from 'nestjs-pino';
import { Prisma, TokenType } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailService } from '@/modules/email/email.service';
import { hash, compare } from 'bcryptjs';
import { randomBytes, createHash } from 'crypto';
import { InvalidCredentialsException, EmailNotVerifiedException, InvalidRefreshTokenException, InvalidTokenException, TokenExpiredException, AlreadyVerifiedException, InvalidPasswordException } from './auth.exceptions';
import { InternalServerErrorException, UnauthorizedException, UserAlreadyExistsException } from '@/common/exceptions';
import { getViolatedFields } from '@/common/utils/prisma';
import { UserResponseDto } from '@/common/dto/user-response.dto';

function parseDuration(duration: string): number {
  const units: Record<string, number> = {
    d: 86_400_000,
    h: 3_600_000,
    m: 60_000,
    s: 1_000,
  };
  const match = duration.match(/^(\d+)([dhms])$/);
  if (!match) {
    throw new InternalServerErrorException(
      'INVALID_DURATION_FORMAT',
      `Invalid duration format: ${duration}`,
    );
  }
  return parseInt(match[1], 10) * (units[match[2]] ?? 0);
}

function generateOpaqueToken(): string {
  return randomBytes(64).toString('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly logger: Logger,
  ) {}

  async register(email: string, password: string): Promise<void> {
    const hashedPassword = await hash(password, 12);

    try {
      const verificationToken = generateOpaqueToken();
      const verificationTokenHash = hashToken(verificationToken);
      const verificationExpiry =
        this.configService.get<string>('EMAIL_VERIFICATION_TOKEN_EXPIRATION') ?? '24h';
      const expiresAt = new Date(Date.now() + parseDuration(verificationExpiry));

      await this.prisma.$transaction(async (tx) => {
        const defaultRole = await tx.role.findUnique({
          where: { name: 'user' },
          select: { id: true },
        });

        if (!defaultRole) {
          throw new InternalServerErrorException(
            'DEFAULT_ROLE_NOT_FOUND',
            'Default user role not found',
          );
        }

        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            isVerified: false,
            roleId: defaultRole.id,
          },
        });

        await tx.verificationToken.create({
          data: {
            userId: user.id,
            type: TokenType.EMAIL_VERIFICATION,
            tokenHash: verificationTokenHash,
            expiresAt,
          },
        });
      });

      try {
        await this.emailService.sendVerificationEmail(email, verificationToken);
      } catch (error) {
        this.logger.warn(
          { err: error instanceof Error ? error : String(error), email },
          'Failed to send verification email',
        );
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        getViolatedFields(error.meta).includes('email')
      ) {
        throw new UserAlreadyExistsException();
      }
      throw error;
    }
  }

  async login(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    user: UserResponseDto;
    expiresAt: Date;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: { select: { id: true, name: true } } },
    });

    if (!user) {
      throw new InvalidCredentialsException();
    }

    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    if (!user.isActive) {
      throw new InvalidCredentialsException();
    }

    if (!user.isVerified) {
      throw new EmailNotVerifiedException();
    }

    const accessToken = this.jwtService.sign({ sub: user.id, roleId: user.roleId });

    const refreshToken = generateOpaqueToken();
    const refreshTokenHash = hashToken(refreshToken);

    const refreshTokenExpiry =
      this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION') ?? '7d';
    const expiresAt = new Date(Date.now() + parseDuration(refreshTokenExpiry));

    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
      },
    });

    const userDto: UserResponseDto = {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      isVerified: user.isVerified,
      role: user.role,
      createdAt: user.createdAt,
    };

    return { accessToken, refreshToken, user: userDto, expiresAt };
  }

  async refresh(
    refreshToken: string | undefined,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  }> {
    if (!refreshToken) {
      throw new InvalidRefreshTokenException();
    }

    const tokenHash = hashToken(refreshToken);

    return this.prisma.$transaction(async (tx) => {
      let session: { id: string; userId: string; expiresAt: Date };
      try {
        session = await tx.session.delete({ where: { tokenHash } });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          throw new InvalidRefreshTokenException();
        }
        throw error;
      }

      if (session.expiresAt < new Date()) {
        throw new InvalidRefreshTokenException();
      }

      const newRefreshToken = generateOpaqueToken();
      const newRefreshTokenHash = hashToken(newRefreshToken);

      const refreshTokenExpiry =
        this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION') ?? '7d';
      const expiresAt = new Date(Date.now() + parseDuration(refreshTokenExpiry));

      await tx.session.create({
        data: {
          userId: session.userId,
          tokenHash: newRefreshTokenHash,
          expiresAt,
        },
      });

      const user = await tx.user.findUnique({
        where: { id: session.userId },
        select: { roleId: true },
      });

      if (!user) {
        throw new InvalidRefreshTokenException();
      }

      const accessToken = this.jwtService.sign({ sub: session.userId, roleId: user.roleId });

      return { accessToken, refreshToken: newRefreshToken, expiresAt };
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    await this.prisma.session.deleteMany({
      where: { tokenHash },
    });
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { message: 'If an account with that email exists, we sent a reset link.' };
    }

    const resetToken = generateOpaqueToken();
    const resetTokenHash = hashToken(resetToken);
    const expiryDuration =
      this.configService.get<string>('PASSWORD_RESET_TOKEN_EXPIRATION') ?? '1h';
    const expiresAt = new Date(Date.now() + parseDuration(expiryDuration));

    await this.prisma.$transaction(async (tx) => {
      await tx.verificationToken.deleteMany({
        where: { userId: user.id, type: TokenType.PASSWORD_RESET },
      });

      await tx.verificationToken.create({
        data: {
          userId: user.id,
          type: TokenType.PASSWORD_RESET,
          tokenHash: resetTokenHash,
          expiresAt,
        },
      });
    });

    try {
      await this.emailService.sendPasswordResetEmail(email, resetToken);
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error : String(error), email },
        'Failed to send password reset email',
      );
    }

    return { message: 'If an account with that email exists, we sent a reset link.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = hashToken(token);
    const hashedPassword = await hash(newPassword, 12);

    return this.prisma.$transaction(async (tx) => {
      const tokenRecord = await tx.verificationToken.findFirst({
        where: {
          tokenHash,
          type: TokenType.PASSWORD_RESET,
        },
      });

      if (!tokenRecord) {
        throw new InvalidTokenException();
      }

      if (tokenRecord.expiresAt < new Date()) {
        throw new TokenExpiredException();
      }

      await tx.user.update({
        where: { id: tokenRecord.userId },
        data: { password: hashedPassword },
      });

      await tx.verificationToken.deleteMany({
        where: {
          userId: tokenRecord.userId,
          type: TokenType.PASSWORD_RESET,
        },
      });

      await tx.session.deleteMany({
        where: { userId: tokenRecord.userId },
      });

      return { message: 'Password has been reset successfully' };
    });
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const tokenHash = hashToken(token);

    return this.prisma.$transaction(async (tx) => {
      const tokenRecord = await tx.verificationToken.findFirst({
        where: {
          tokenHash,
          type: TokenType.EMAIL_VERIFICATION,
        },
      });

      if (!tokenRecord) {
        throw new InvalidTokenException();
      }

      if (tokenRecord.expiresAt < new Date()) {
        throw new TokenExpiredException();
      }

      const user = await tx.user.findUnique({
        where: { id: tokenRecord.userId },
      });

      if (!user) {
        throw new InvalidTokenException();
      }

      if (user.isVerified) {
        throw new AlreadyVerifiedException();
      }

      await tx.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });

      await tx.verificationToken.deleteMany({
        where: {
          userId: user.id,
          type: TokenType.EMAIL_VERIFICATION,
        },
      });

      return { message: 'Email verified successfully' };
    });
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { message: 'If an account with that email exists, we sent a verification link.' };
    }

    if (user.isVerified) {
      return { message: 'If an account with that email exists, we sent a verification link.' };
    }

    const verificationToken = generateOpaqueToken();
    const verificationTokenHash = hashToken(verificationToken);
    const verificationExpiry =
      this.configService.get<string>('EMAIL_VERIFICATION_TOKEN_EXPIRATION') ?? '24h';
    const expiresAt = new Date(Date.now() + parseDuration(verificationExpiry));

    await this.prisma.$transaction(async (tx) => {
      await tx.verificationToken.deleteMany({
        where: { userId: user.id, type: TokenType.EMAIL_VERIFICATION },
      });

      await tx.verificationToken.create({
        data: {
          userId: user.id,
          type: TokenType.EMAIL_VERIFICATION,
          tokenHash: verificationTokenHash,
          expiresAt,
        },
      });
    });

    try {
      await this.emailService.sendVerificationEmail(email, verificationToken);
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error : String(error), email },
        'Failed to send verification email',
      );
    }

    return { message: 'If an account with that email exists, we sent a verification link.' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: UserResponseDto; expiresAt: Date }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: { select: { id: true, name: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('UNAUTHORIZED', 'Unauthorized');
    }

    if (!user.isActive) {
      throw new InvalidCredentialsException();
    }

    if (!user.isVerified) {
      throw new EmailNotVerifiedException();
    }

    const isCurrentPasswordValid = await compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new InvalidPasswordException();
    }

    const hashedPassword = await hash(newPassword, 12);

    const refreshToken = generateOpaqueToken();
    const refreshTokenHash = hashToken(refreshToken);
    const refreshTokenExpiry =
      this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRATION') ?? '7d';
    const expiresAt = new Date(Date.now() + parseDuration(refreshTokenExpiry));

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      await tx.session.deleteMany({ where: { userId } });

      await tx.session.create({
        data: {
          userId,
          tokenHash: refreshTokenHash,
          expiresAt,
        },
      });
    });

    const accessToken = this.jwtService.sign({ sub: user.id, roleId: user.roleId });

    const userDto: UserResponseDto = {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      isVerified: user.isVerified,
      role: user.role,
      createdAt: user.createdAt,
    };

    return { accessToken, refreshToken, user: userDto, expiresAt };
  }

  async cleanupExpiredSessions(): Promise<{ count: number }> {
    const result = await this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return { count: result.count };
  }

  async cleanupExpiredVerificationTokens(): Promise<{ count: number }> {
    const result = await this.prisma.verificationToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return { count: result.count };
  }
}
