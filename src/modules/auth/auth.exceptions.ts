import { ConflictException, ForbiddenException, UnauthorizedException, BadRequestException } from '@/common/exceptions';

export class EmailNotVerifiedException extends ForbiddenException {
  constructor() {
    super('EMAIL_NOT_VERIFIED', 'Email not verified');
  }
}

export class InvalidRefreshTokenException extends UnauthorizedException {
  constructor() {
    super('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token');
  }
}

export class InvalidTokenException extends BadRequestException {
  constructor() {
    super('INVALID_TOKEN', 'Invalid or expired token');
  }
}

export class TokenExpiredException extends BadRequestException {
  constructor() {
    super('TOKEN_EXPIRED', 'Token has expired');
  }
}

export class AlreadyVerifiedException extends ConflictException {
  constructor() {
    super('EMAIL_ALREADY_VERIFIED', 'Email is already verified');
  }
}

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    super('INVALID_CREDENTIALS', 'Invalid email or password');
  }
}