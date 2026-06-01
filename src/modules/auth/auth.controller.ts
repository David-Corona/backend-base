import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiExtraModels } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { SessionResponseDto } from '@/common/dto/session-response.dto';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { VerifyEmailRequestDto } from './dto/verify-email-request.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ResetPasswordRequestDto } from './dto/reset-password-request.dto';
import { ResendVerificationRequestDto } from './dto/resend-verification-request.dto';
import { ChangePasswordRequestDto } from './dto/change-password-request.dto';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { PaginatedSessionsResponseDto } from './dto/paginated-sessions-response.dto';
import {
  RegisterDocs,
  LoginDocs,
  RefreshDocs,
  LogoutDocs,
  VerifyEmailDocs,
  ResendVerificationDocs,
  ForgotPasswordDocs,
  ResetPasswordDocs,
  ChangePasswordDocs,
  ListSessionsDocs,
  TerminateSessionDocs,
  TerminateAllOtherSessionsDocs,
} from './auth.docs';

const AUTH_RATE_LIMIT = parseInt(process.env.RATE_LIMIT_AUTH ?? '10', 10);

@ApiTags('Auth')
@ApiExtraModels(PaginatedSessionsResponseDto)
@Controller('auth')
@Throttle({ default: { limit: AUTH_RATE_LIMIT } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
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
  @RegisterDocs()
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterRequestDto,
  ): Promise<{ message: string }> {
    await this.authService.register(dto.email, dto.password);
    return { message: 'Registration successful. Please verify your email.' };
  }

  @Post('login')
  @Public()
  @LoginDocs()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const userAgent = req.headers['user-agent'];
    const ip = req.ip;
    const result = await this.authService.login(dto.email, dto.password, { userAgent, ip });

    this.setRefreshTokenCookie(res, result.refreshToken, result.expiresAt);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  @Public()
  @RefreshDocs()
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
  @LogoutDocs()
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
  @VerifyEmailDocs()
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @Body() dto: VerifyEmailRequestDto,
  ): Promise<{ message: string }> {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @Public()
  @ResendVerificationDocs()
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Body() dto: ResendVerificationRequestDto,
  ): Promise<{ message: string }> {
    return this.authService.resendVerification(dto.email);
  }

  @Post('forgot-password')
  @Public()
  @ForgotPasswordDocs()
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordRequestDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @Public()
  @ResetPasswordDocs()
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordRequestDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Post('change-password')
  @ChangePasswordDocs()
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('userId') userId: string,
    @Body() dto: ChangePasswordRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const userAgent = req.headers['user-agent'];
    const ip = req.ip;
    const result = await this.authService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
      { userAgent, ip },
    );

    this.setRefreshTokenCookie(res, result.refreshToken, result.expiresAt);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Get('sessions')
  @ListSessionsDocs()
  async listSessions(
    @CurrentUser('userId') userId: string,
    @CurrentUser('sessionId') sessionId: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<SessionResponseDto>> {
    return this.sessionService.listSessions(userId, sessionId, pagination.page, pagination.limit);
  }

  @Delete('sessions/:id')
  @TerminateSessionDocs()
  @HttpCode(HttpStatus.NO_CONTENT)
  async terminateSession(@Param('id') id: string, @CurrentUser('userId') userId: string, @CurrentUser('sessionId') sessionId: string): Promise<void> {
    await this.sessionService.terminateSession(id, {
      userId,
      currentSessionId: sessionId,
    });
  }

  @Delete('sessions')
  @TerminateAllOtherSessionsDocs()
  @HttpCode(HttpStatus.NO_CONTENT)
  async terminateAllOtherSessions(@CurrentUser('userId') userId: string, @CurrentUser('sessionId') sessionId: string): Promise<void> {
    await this.sessionService.terminateAllOtherSessions(userId, sessionId);
  }
}
