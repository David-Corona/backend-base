import { ForbiddenException, NotFoundException } from '@/common/exceptions';

export class SessionNotFoundException extends NotFoundException {
  constructor() {
    super('SESSION_NOT_FOUND', 'Session not found');
  }
}

export class CannotTerminateCurrentSessionException extends ForbiddenException {
  constructor() {
    super('CANNOT_TERMINATE_CURRENT_SESSION', 'Cannot terminate your current session');
  }
}
