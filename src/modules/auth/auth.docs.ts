import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { RegisterRequestDto } from './dto/register-request.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { VerifyEmailRequestDto } from './dto/verify-email-request.dto';
import { ResendVerificationRequestDto } from './dto/resend-verification-request.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ResetPasswordRequestDto } from './dto/reset-password-request.dto';
import { ChangePasswordRequestDto } from './dto/change-password-request.dto';
import { PaginatedSessionsResponseDto } from './dto/paginated-sessions-response.dto';

export const RegisterDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Register a new user',
      description:
        'Creates a new user account with the provided email and password. Sends a verification email to the user. Returns a confirmation message.',
    }),
    ApiBody({ type: RegisterRequestDto }),
    ApiCreatedResponse({
      schema: {
        properties: {
          message: {
            type: 'string',
            example: 'Registration successful. Please verify your email.',
          },
        },
      },
      description: 'Registration successful',
    }),
    ApiConflictResponse({
      description: 'USER_ALREADY_EXISTS - A user with this email already exists',
    }),
  );

export const LoginDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Log in',
      description:
        'Authenticates a user with email and password. Returns a JWT access token and sets an HTTP-only refresh token cookie. The user must have a verified email and an active account.',
    }),
    ApiBody({ type: LoginRequestDto }),
    ApiOkResponse({ type: LoginResponseDto, description: 'Login successful' }),
    ApiUnauthorizedResponse({
      description: 'INVALID_CREDENTIALS - Invalid email or password',
    }),
    ApiForbiddenResponse({
      description: 'EMAIL_NOT_VERIFIED - Email not verified',
    }),
  );

export const RefreshDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Refresh access token',
      description:
        'Exchanges a valid refresh token (from HTTP-only cookie) for a new JWT access token and rotates the refresh token.',
    }),
    ApiOkResponse({
      schema: {
        properties: {
          accessToken: {
            type: 'string',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          },
        },
      },
      description: 'Access token refreshed successfully',
    }),
    ApiUnauthorizedResponse({
      description: 'INVALID_REFRESH_TOKEN - Invalid or expired refresh token',
    }),
  );

export const LogoutDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Log out',
      description:
        'Terminates the current session by deleting the refresh token and clears the refresh token cookie.',
    }),
    ApiResponse({ status: 204, description: 'Logged out successfully' }),
  );

export const VerifyEmailDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Verify email address',
      description:
        'Verifies a user email address using the token received via the verification email.',
    }),
    ApiBody({ type: VerifyEmailRequestDto }),
    ApiOkResponse({
      schema: {
        properties: {
          message: { type: 'string', example: 'Email verified successfully' },
        },
      },
      description: 'EMAIL_VERIFIED - Email verified successfully',
    }),
    ApiBadRequestResponse({
      description:
        'INVALID_TOKEN - Invalid or expired token; TOKEN_EXPIRED - Token has expired',
    }),
    ApiConflictResponse({
      description: 'EMAIL_ALREADY_VERIFIED - Email is already verified',
    }),
  );

export const ResendVerificationDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Resend verification email',
      description:
        'Resends a verification email to the specified address. Always returns a success message regardless of whether the account exists or is already verified.',
    }),
    ApiBody({ type: ResendVerificationRequestDto }),
    ApiOkResponse({
      schema: {
        properties: {
          message: {
            type: 'string',
            example:
              'If an account with that email exists, we sent a verification link.',
          },
        },
      },
      description: 'Verification email sent (if account exists)',
    }),
  );

export const ForgotPasswordDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Request password reset',
      description:
        'Sends a password reset email to the specified address. Always returns a success message regardless of whether the account exists.',
    }),
    ApiBody({ type: ForgotPasswordRequestDto }),
    ApiOkResponse({
      schema: {
        properties: {
          message: {
            type: 'string',
            example:
              'If an account with that email exists, we sent a reset link.',
          },
        },
      },
      description: 'Password reset email sent (if account exists)',
    }),
  );

export const ResetPasswordDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Reset password',
      description:
        'Resets a user password using the token received via the password reset email. All existing sessions for the user are terminated after the reset.',
    }),
    ApiBody({ type: ResetPasswordRequestDto }),
    ApiOkResponse({
      schema: {
        properties: {
          message: {
            type: 'string',
            example: 'Password has been reset successfully',
          },
        },
      },
      description: 'Password reset successfully',
    }),
    ApiBadRequestResponse({
      description:
        'INVALID_TOKEN - Invalid or expired token; TOKEN_EXPIRED - Token has expired',
    }),
  );

export const ChangePasswordDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Change password',
      description:
        'Changes the authenticated user password after verifying the current password. All existing sessions are terminated and a new session is created.',
    }),
    ApiBody({ type: ChangePasswordRequestDto }),
    ApiOkResponse({ type: LoginResponseDto, description: 'Password changed successfully' }),
    ApiUnauthorizedResponse({
      description:
        'AUTH_REQUIRED - Authentication required; INVALID_CREDENTIALS - Account is inactive; EMAIL_NOT_VERIFIED - Email not verified; INVALID_PASSWORD - Current password is incorrect',
    }),
  );

export const ListSessionsDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'List user sessions',
      description:
        'Returns a paginated list of active sessions for the authenticated user, sorted by creation date descending.',
    }),
    ApiOkResponse({
      type: PaginatedSessionsResponseDto,
      description: 'Paginated list of sessions',
    }),
    ApiUnauthorizedResponse({
      description: 'AUTH_REQUIRED - Authentication required',
    }),
  );

export const TerminateSessionDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Terminate a session',
      description:
        'Terminates a specific session by ID. Cannot terminate the current session.',
    }),
    ApiParam({
      name: 'id',
      description: 'Session UUID',
      format: 'uuid',
      example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    }),
    ApiResponse({ status: 204, description: 'Session terminated successfully' }),
    ApiUnauthorizedResponse({
      description: 'AUTH_REQUIRED - Authentication required',
    }),
    ApiForbiddenResponse({
      description: 'CANNOT_TERMINATE_CURRENT_SESSION - Cannot terminate your current session',
    }),
    ApiNotFoundResponse({
      description: 'SESSION_NOT_FOUND - Session not found',
    }),
  );

export const TerminateAllOtherSessionsDocs = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Terminate all other sessions',
      description:
        'Terminates all sessions for the authenticated user except the current active session.',
    }),
    ApiResponse({ status: 204, description: 'All other sessions terminated successfully' }),
    ApiUnauthorizedResponse({
      description: 'AUTH_REQUIRED - Authentication required',
    }),
  );
