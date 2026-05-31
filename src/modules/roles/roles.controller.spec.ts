import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { PERMISSIONS } from '@/common/permissions';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import type { RoleResponseDto } from './dto/role-response.dto';
import type { PermissionResponseDto } from './dto/permission-response.dto';

describe('RolesController', () => {
  let controller: RolesController;
  let rolesService: jest.Mocked<RolesService>;

  const mockRole: RoleResponseDto = {
    id: 'role-1',
    name: 'editor',
    description: 'Can edit content',
    permissions: [PERMISSIONS.ROLES_READ],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RolesService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            findAllPermissions: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(RolesController);
    rolesService = module.get(RolesService);
  });

  describe('findAll', () => {
    it('returns paginated roles', async () => {
      const paginatedResult: PaginatedResponse<RoleResponseDto> = {
        data: [mockRole],
        meta: { total: 1, page: 1, limit: 25, totalPages: 1 },
      };
      rolesService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll({ page: 1, limit: 25 });

      expect(rolesService.findAll).toHaveBeenCalledWith(1, 25);
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findOne', () => {
    it('returns a role by id', async () => {
      rolesService.findOne.mockResolvedValue(mockRole);

      const result = await controller.findOne('role-1');

      expect(rolesService.findOne).toHaveBeenCalledWith('role-1');
      expect(result).toEqual(mockRole);
    });
  });

  describe('create', () => {
    it('creates a new role', async () => {
      rolesService.create.mockResolvedValue(mockRole);

      const result = await controller.create({
        name: 'editor',
        description: 'Can edit content',
        permissions: [PERMISSIONS.ROLES_READ],
      });

      expect(rolesService.create).toHaveBeenCalledWith({
        name: 'editor',
        description: 'Can edit content',
        permissions: [PERMISSIONS.ROLES_READ],
      });
      expect(result).toEqual(mockRole);
    });
  });

  describe('update', () => {
    it('updates a role', async () => {
      const updatedRole = { ...mockRole, name: 'updated-editor' };
      rolesService.update.mockResolvedValue(updatedRole);

      const result = await controller.update('role-1', { name: 'updated-editor' });

      expect(rolesService.update).toHaveBeenCalledWith('role-1', { name: 'updated-editor' });
      expect(result).toEqual(updatedRole);
    });
  });

  describe('remove', () => {
    it('deletes a role', async () => {
      rolesService.remove.mockResolvedValue();

      await controller.remove('role-1');

      expect(rolesService.remove).toHaveBeenCalledWith('role-1');
    });
  });
});

describe('PermissionsController', () => {
  // Import here to avoid circular dependency issues
  let controller: import('./permissions.controller').PermissionsController;
  let rolesService: jest.Mocked<RolesService>;

  const mockPermission: PermissionResponseDto = {
    id: 'perm-1',
    key: PERMISSIONS.ROLES_READ,
    name: 'Read Roles',
    description: 'View roles',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const { PermissionsController } = await import('./permissions.controller');

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [
        {
          provide: RolesService,
          useValue: {
            findAllPermissions: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PermissionsController);
    rolesService = module.get(RolesService);
  });

  describe('findAll', () => {
    it('returns paginated permissions', async () => {
      const paginatedResult: PaginatedResponse<PermissionResponseDto> = {
        data: [mockPermission],
        meta: { total: 1, page: 1, limit: 25, totalPages: 1 },
      };
      rolesService.findAllPermissions.mockResolvedValue(paginatedResult);

      const result = await controller.findAll({ page: 1, limit: 25 });

      expect(rolesService.findAllPermissions).toHaveBeenCalledWith(1, 25);
      expect(result).toEqual(paginatedResult);
    });
  });
});
