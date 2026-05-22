import { NotFoundException, ConflictException, BadRequestException } from '@/common/exceptions';

export class RoleNotFoundException extends NotFoundException {
  constructor() {
    super('ROLE_NOT_FOUND', 'Role not found');
  }
}

export class RoleAlreadyExistsException extends ConflictException {
  constructor() {
    super('ROLE_ALREADY_EXISTS', 'Role with this name already exists');
  }
}

export class RoleInUseException extends ConflictException {
  constructor() {
    super('ROLE_IN_USE', 'Cannot delete role while it is assigned to users');
  }
}

export class RoleProtectedException extends ConflictException {
  constructor() {
    super('ROLE_PROTECTED', 'Cannot delete a system role');
  }
}

export class InvalidPermissionsException extends BadRequestException {
  constructor() {
    super('INVALID_PERMISSIONS', 'One or more permissions do not exist');
  }
}
