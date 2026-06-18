export const PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_DELETE: 'users:delete',
  USERS_ASSIGN_ROLE: 'users:assign-role',
  ROLES_READ: 'roles:read',
  ROLES_WRITE: 'roles:write',
  ROLES_DELETE: 'roles:delete',
  SESSIONS_READ: 'sessions:read',
  SESSIONS_TERMINATE: 'sessions:terminate',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
