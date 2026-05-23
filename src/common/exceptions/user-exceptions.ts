import { NotFoundException, ConflictException } from './http-exceptions';

export class UserNotFoundException extends NotFoundException {
  constructor() {
    super('USER_NOT_FOUND', 'User not found');
  }
}

export class UserAlreadyExistsException extends ConflictException {
  constructor() {
    super('USER_ALREADY_EXISTS', 'User with this email already exists');
  }
}
