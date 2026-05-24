import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { RegisterRequestDto } from './dto/register-request.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { VerifyEmailRequestDto } from './dto/verify-email-request.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ResetPasswordRequestDto } from './dto/reset-password-request.dto';
import { ResendVerificationRequestDto } from './dto/resend-verification-request.dto';
import { ChangePasswordRequestDto } from './dto/change-password-request.dto';

const AUTH_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_AUTH ?? '10', 10);

@Controller('auth')
@Throttle({ default: { limit: AUTH_RATE_LIMIT } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setRefreshTokenCookie(
    res: Response,
    token: string,
    expiresAt: Date,
  ): void {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api/auth',
      expires: expiresAt,
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/api/auth',
    });
  }

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterRequestDto,
  ): Promise<{ message: string }> {
    await this.authService.register(dto.email, dto.password);
    return { message: 'Registration successful. Please verify your email.' };
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.login(dto.email, dto.password);

    this.setRefreshTokenCookie(res, result.refreshToken, result.expiresAt);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const token = req.cookies['refresh_token'] as string | undefined;
    const result = await this.authService.refresh(token);

    this.setRefreshTokenCookie(res, result.refreshToken, result.expiresAt);

    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = req.cookies['refresh_token'] as string | undefined;
    if (token) {
      await this.authService.logout(token);
    }

    this.clearRefreshTokenCookie(res);
  }

  @Post('verify-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() dto: VerifyEmailRequestDto,
  ): Promise<{ message: string }> {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @Public()
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Body() dto: ResendVerificationRequestDto,
  ): Promise<{ message: string }> {
    return this.authService.resendVerification(dto.email);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordRequestDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordRequestDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Req() req: Request,
    @Body() dto: ChangePasswordRequestDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const result = await this.authService.changePassword(
      req.user!.userId,
      dto.currentPassword,
      dto.newPassword,
    );

    this.setRefreshTokenCookie(res, result.refreshToken, result.expiresAt);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }
}
