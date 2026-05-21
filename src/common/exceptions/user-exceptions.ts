import { NotFoundException } from './http-exceptions';

export class UserNotFoundException extends NotFoundException {
  constructor() {
    super('USER_NOT_FOUND', 'User not found');
  }
}
