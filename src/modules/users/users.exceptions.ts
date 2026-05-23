import { BadRequestException } from '@/common/exceptions';

export class DeactivatedSelfException extends BadRequestException {
  constructor() {
    super('CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own account');
  }
}