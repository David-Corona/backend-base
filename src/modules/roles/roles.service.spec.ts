import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { Prisma, PrismaClient } from '@prisma/client';
import { RolesService } from './roles.service';
import { PrismaService } from '@/prisma/prisma.service';
import {
  RoleNotFoundException,
  RoleAlreadyExistsException,
  RoleInUseException,
  RoleProtectedException,
  InvalidPermissionsException,
} from './roles.exceptions';
import { PERMISSIONS } from '@/common/permissions';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
      ],
    }).compile();

    service = module.get(RolesService);
    prisma = module.get(PrismaService);

    prisma.$transaction.mockImplementation(async (callback) => {
      return callback(prisma);
    });
  });

  describe('create', () => {
    it('creates a role with permissions', async () => {
      const mockRole = {
        id: 'role-1',
        name: 'editor',
        description: 'Can edit content',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.role.create.mockResolvedValue(mockRole);
      prisma.permission.findMany.mockResolvedValue([
        { id: 'perm-1' },
        { id: 'perm-2' },
      ] as never);
      prisma.rolePermission.createMany.mockResolvedValue({ count: 2 } as never);
      prisma.role.findUnique.mockResolvedValue({
        ...mockRole,
        permissions: [
          { permission: { key: PERMISSIONS.ROLES_READ } },
          { permission: { key: PERMISSIONS.ROLES_WRITE } },
        ],
      } as never);

      const result = await service.create({
        name: 'editor',
        description: 'Can edit content',
        permissions: [PERMISSIONS.ROLES_READ, PERMISSIONS.ROLES_WRITE],
      });

      expect(result.name).toBe('editor');
      expect(result.permissions).toContain(PERMISSIONS.ROLES_READ);
      expect(result.permissions).toContain(PERMISSIONS.ROLES_WRITE);
    });

    it('throws InvalidPermissionsException when permission does not exist', async () => {
      prisma.role.create.mockResolvedValue({
        id: 'role-1',
        name: 'editor',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.permission.findMany.mockResolvedValue([{ id: 'perm-1' }] as never);

      await expect(
        service.create({
          name: 'editor',
          permissions: [PERMISSIONS.ROLES_READ, 'nonexistent:permission'],
        }),
      ).rejects.toThrow(InvalidPermissionsException);
    });

    it('throws RoleAlreadyExistsException on duplicate name', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          clientVersion: '7.8.0',
          code: 'P2002',
          meta: { target: ['name'] },
        },
      );
      prisma.role.create.mockRejectedValue(prismaError);

      await expect(
        service.create({
          name: 'admin',
          permissions: [],
        }),
      ).rejects.toThrow(RoleAlreadyExistsException);
    });
  });

  describe('findAll', () => {
    it('returns all roles with their permissions', async () => {
      prisma.role.findMany.mockResolvedValue([
        {
          id: 'role-1',
          name: 'admin',
          description: 'Admin role',
          createdAt: new Date(),
          updatedAt: new Date(),
          permissions: [
            { permission: { key: PERMISSIONS.ROLES_READ } },
          ],
        },
      ] as never);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('admin');
      expect(result[0].permissions).toContain(PERMISSIONS.ROLES_READ);
    });
  });

  describe('findOne', () => {
    it('returns a role with permissions', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-1',
        name: 'admin',
        description: 'Admin role',
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [
          { permission: { key: PERMISSIONS.ROLES_READ } },
        ],
      } as never);

      const result = await service.findOne('role-1');

      expect(result.id).toBe('role-1');
      expect(result.permissions).toContain(PERMISSIONS.ROLES_READ);
    });

    it('throws RoleNotFoundException when role does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(RoleNotFoundException);
    });
  });

  describe('update', () => {
    it('updates role name and permissions', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1' } as never);
      prisma.role.update.mockResolvedValue({
        id: 'role-1',
        name: 'updated-name',
        description: 'Updated desc',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      prisma.rolePermission.deleteMany.mockResolvedValue({ count: 1 } as never);
      prisma.permission.findMany.mockResolvedValue([{ id: 'perm-1' }] as never);
      prisma.rolePermission.createMany.mockResolvedValue({ count: 1 } as never);
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-1',
        name: 'updated-name',
        description: 'Updated desc',
        createdAt: new Date(),
        updatedAt: new Date(),
        permissions: [{ permission: { key: PERMISSIONS.ROLES_READ } }],
      } as never);

      const result = await service.update('role-1', {
        name: 'updated-name',
        description: 'Updated desc',
        permissions: [PERMISSIONS.ROLES_READ],
      });

      expect(result.name).toBe('updated-name');
      expect(result.permissions).toContain(PERMISSIONS.ROLES_READ);
    });

    it('throws RoleNotFoundException when role does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'new-name' }),
      ).rejects.toThrow(RoleNotFoundException);
    });

    it('throws InvalidPermissionsException when permission does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1' } as never);
      prisma.rolePermission.deleteMany.mockResolvedValue({ count: 0 } as never);
      prisma.permission.findMany.mockResolvedValue([{ id: 'perm-1' }] as never);

      await expect(
        service.update('role-1', {
          permissions: [PERMISSIONS.ROLES_READ, 'nonexistent:permission'],
        }),
      ).rejects.toThrow(InvalidPermissionsException);
    });
  });

  describe('remove', () => {
    it('deletes a role when no users are assigned', async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(prisma);
      });
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-1',
        name: 'test-role',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      prisma.user.count.mockResolvedValue(0);
      prisma.role.delete.mockResolvedValue({
        id: 'role-1',
        name: 'test-role',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      await service.remove('role-1');

      expect(prisma.role.delete.mock.calls.length).toBe(1);
    });

    it('throws RoleNotFoundException when role does not exist', async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(prisma);
      });
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(RoleNotFoundException);
    });

    it('throws RoleProtectedException for system roles', async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(prisma);
      });
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-admin',
        name: 'admin',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      await expect(service.remove('role-admin')).rejects.toThrow(RoleProtectedException);
    });

    it('throws RoleInUseException when users are assigned', async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(prisma);
      });
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-1',
        name: 'test-role',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      prisma.user.count.mockResolvedValue(3);

      await expect(service.remove('role-1')).rejects.toThrow(RoleInUseException);
    });
  });

  describe('getPermissionsForRole', () => {
    it('returns permission keys for a role', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([
        { roleId: 'role-1', permissionId: 'perm-1', permission: { key: PERMISSIONS.ROLES_READ } },
        { roleId: 'role-1', permissionId: 'perm-2', permission: { key: PERMISSIONS.ROLES_WRITE } },
      ] as never);

      const result = await service.getPermissionsForRole('role-1');

      expect(result).toContain(PERMISSIONS.ROLES_READ);
      expect(result).toContain(PERMISSIONS.ROLES_WRITE);
    });
  });

  describe('findAllPermissions', () => {
    it('returns all permissions', async () => {
      prisma.permission.findMany.mockResolvedValue([
        { id: 'perm-1', key: PERMISSIONS.ROLES_READ, name: 'Read Roles', description: null, createdAt: new Date(), updatedAt: new Date() },
        { id: 'perm-2', key: PERMISSIONS.ROLES_WRITE, name: 'Write Roles', description: null, createdAt: new Date(), updatedAt: new Date() },
      ] as never);

      const result = await service.findAllPermissions();

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe(PERMISSIONS.ROLES_READ);
    });
  });
});
