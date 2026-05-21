import { AppException } from './app-exception';

export class NotFoundException extends AppException {
  constructor(code: string, message: string) {
    super(404, code, message);
  }
}

export class BadRequestException extends AppException {
  constructor(code: string, message: string) {
    super(400, code, message);
  }
}

export class UnauthorizedException extends AppException {
  constructor(code: string, message: string) {
    super(401, code, message);
  }
}

export class ForbiddenException extends AppException {
  constructor(code: string, message: string) {
    super(403, code, message);
  }
}

export class ConflictException extends AppException {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class InternalServerErrorException extends AppException {
  constructor(code: string, message: string) {
    super(500, code, message);
  }
}
