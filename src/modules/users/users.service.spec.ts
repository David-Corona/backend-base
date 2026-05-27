import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { UsersService } from './users.service';
import { UserNotFoundException, UserAlreadyExistsException } from '@/common/exceptions';
import { RoleNotFoundException } from '@/modules/roles/roles.exceptions';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { UserStatusFilter } from './dto/users-pagination-query.dto';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: DeepMockProxy<PrismaService>;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User' as string | null,
    password: 'hashedpassword',
    isActive: true,
    isVerified: true,
    roleId: 'role-1',
    role: { id: 'role-1', name: 'user' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockAdminUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin User' as string | null,
    password: 'hashedpassword',
    isActive: true,
    isVerified: true,
    roleId: 'role-admin',
    role: { id: 'role-admin', name: 'admin' },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
      ],
    }).compile();

    service = module.get(UsersService);
    prisma = module.get(PrismaService);

    prisma.$transaction.mockImplementation(async (callback) => {
      return callback(prisma);
    });
  });

  describe('findAll', () => {
    it('returns paginated list of active users by default', async () => {
      prisma.user.count.mockResolvedValue(2);
      prisma.user.findMany.mockResolvedValue([mockUser, mockAdminUser]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(result.data[0]).toMatchObject({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        isVerified: true,
        role: { id: 'role-1', name: 'user' },
      });
      expect(prisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('filters by inactive status', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      prisma.user.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([inactiveUser]);

      const result = await service.findAll({ page: 1, limit: 20, status: UserStatusFilter.INACTIVE });

      expect(result.data).toHaveLength(1);
      expect(prisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } }),
      );
    });

    it('returns all users when status is all', async () => {
      prisma.user.count.mockResolvedValue(2);
      prisma.user.findMany.mockResolvedValue([mockUser, mockAdminUser]);

      const result = await service.findAll({ page: 1, limit: 20, status: UserStatusFilter.ALL });

      expect(result.data).toHaveLength(2);
      expect(prisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('calculates totalPages correctly', async () => {
      prisma.user.count.mockResolvedValue(45);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.meta.totalPages).toBe(3);
    });

    it('returns totalPages 0 when no users exist', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.meta.totalPages).toBe(0);
    });

    it('filters by name using case-insensitive contains', async () => {
      prisma.user.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.findAll({ page: 1, limit: 20, status: UserStatusFilter.ALL, name: 'test' });

      expect(result.data).toHaveLength(1);
      expect(prisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'test', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('filters by email using case-insensitive contains', async () => {
      prisma.user.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.findAll({ page: 1, limit: 20, status: UserStatusFilter.ALL, email: 'example' });

      expect(result.data).toHaveLength(1);
      expect(prisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            email: { contains: 'example', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('filters by both name and email simultaneously', async () => {
      prisma.user.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.findAll({ page: 1, limit: 20, status: UserStatusFilter.ALL, name: 'Test', email: 'test@example.com' });

      expect(result.data).toHaveLength(1);
      expect(prisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'Test', mode: 'insensitive' },
            email: { contains: 'test@example.com', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('combines status filter with name filter', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 20, status: UserStatusFilter.ACTIVE, name: 'nonexistent' });

      expect(prisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, name: { contains: 'nonexistent', mode: 'insensitive' } },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a user by id', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('user-1');

      expect(result).toMatchObject({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      });
    });

    it('throws UserNotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(UserNotFoundException);
    });
  });

  describe('create', () => {
    it('creates a user with hashed password and default role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'user' } as never);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.create({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toMatchObject({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        isActive: true,
        isVerified: true,
      });
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isVerified: true,
          }),
        }),
      );
    });

    it('creates a user with a specific role', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-admin', name: 'admin' } as never);
      prisma.user.create.mockResolvedValue(mockAdminUser);

      await service.create({
        email: 'admin@example.com',
        password: 'password123',
        roleId: 'role-admin',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            roleId: 'role-admin',
          }),
        }),
      );
    });

    it('creates a user with a name', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'user' } as never);
      prisma.user.create.mockResolvedValue(mockUser);

      await service.create({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Test User',
          }),
        }),
      );
    });

    it('throws RoleNotFoundException when specified role does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          email: 'test@example.com',
          password: 'password123',
          roleId: 'nonexistent',
        }),
      ).rejects.toThrow(RoleNotFoundException);
    });

    it('throws UserAlreadyExistsException on duplicate email', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'user' } as never);
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '1.0',
        meta: { target: ['email'] },
      });
      prisma.user.create.mockRejectedValue(error);

      await expect(
        service.create({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UserAlreadyExistsException);
    });

    it('throws RoleNotFoundException on P2003 foreign key violation', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-1', name: 'user' } as never);
      const error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '1.0',
      });
      prisma.user.create.mockRejectedValue(error);

      await expect(
        service.create({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(RoleNotFoundException);
    });
  });

  describe('update', () => {
    it('updates user name', async () => {
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.update('user-1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('throws UserNotFoundException when user does not exist', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '1.0',
      });
      prisma.user.update.mockRejectedValue(error);

      await expect(service.update('nonexistent', { name: 'New' })).rejects.toThrow(UserNotFoundException);
    });
  });

  describe('deactivate', () => {
    it('deactivates a user and deletes their sessions', async () => {
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(prisma);
      });
      prisma.user.update.mockResolvedValue({ ...mockUser, isActive: false });
      prisma.session.deleteMany.mockResolvedValue({ count: 2 });

      await service.deactivate('user-2');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-2' },
          data: { isActive: false },
        }),
      );
      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-2' },
      });
    });

    it('throws UserNotFoundException when user does not exist', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '1.0',
      });
      prisma.$transaction.mockRejectedValue(error);

      await expect(service.deactivate('nonexistent')).rejects.toThrow(UserNotFoundException);
    });
  });

  describe('activate', () => {
    it('reactivates a deactivated user', async () => {
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.activate('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { isActive: true },
        }),
      );
      expect(result.isActive).toBe(true);
    });

    it('throws UserNotFoundException when user does not exist', async () => {
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '1.0',
      });
      prisma.user.update.mockRejectedValue(error);

      await expect(service.activate('nonexistent')).rejects.toThrow(UserNotFoundException);
    });
  });

  describe('assignRole', () => {
    it('assigns a role to a user', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-admin', name: 'admin' } as never);
      const updatedUser = { ...mockUser, roleId: 'role-admin', role: { id: 'role-admin', name: 'admin' } };
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.assignRole('user-1', 'role-admin');

      expect(result.role).toEqual({ id: 'role-admin', name: 'admin' });
    });

    it('throws RoleNotFoundException when role does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(service.assignRole('user-1', 'nonexistent')).rejects.toThrow(RoleNotFoundException);
    });

    it('throws UserNotFoundException when user does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue({ id: 'role-admin', name: 'admin' } as never);
      const error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '1.0',
      });
      prisma.user.update.mockRejectedValue(error);

      await expect(service.assignRole('nonexistent', 'role-admin')).rejects.toThrow(UserNotFoundException);
    });
  });
});