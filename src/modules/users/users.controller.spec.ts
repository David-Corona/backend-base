import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SessionService } from '@/modules/auth/session.service';
import { SessionResponseDto } from '@/common/dto/session-response.dto';
import { UserResponseDto } from '@/common/dto/user-response.dto';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;
  let sessionService: jest.Mocked<SessionService>;

  const mockUserResponse: UserResponseDto = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    isActive: true,
    isVerified: true,
    role: { id: 'role-1', name: 'user' },
    permissions: ['users:read'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockSessionResponse: SessionResponseDto = {
    id: 'session-1',
    isCurrent: false,
    userAgent: 'Mozilla/5.0',
    ip: '127.0.0.1',
    expiresAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findAll: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            deactivate: jest.fn(),
            activate: jest.fn(),
            assignRole: jest.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: {
            listSessions: jest.fn(),
            terminateSession: jest.fn(),
            terminateAllSessions: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(UsersController);
    usersService = module.get(UsersService);
    sessionService = module.get(SessionService);
  });

  describe('findAll', () => {
    it('returns paginated users', async () => {
      const paginatedResult: PaginatedResponse<UserResponseDto> = {
        data: [mockUserResponse],
        meta: { total: 1, page: 1, limit: 25, totalPages: 1 },
      };
      usersService.findAll.mockResolvedValue(paginatedResult);

      const result = await controller.findAll({ page: 1, limit: 25 });

      expect(usersService.findAll).toHaveBeenCalledWith({ page: 1, limit: 25 });
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findMe', () => {
    it('returns the current user', async () => {
      usersService.findOne.mockResolvedValue(mockUserResponse);

      const result = await controller.findMe('user-1');

      expect(usersService.findOne).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockUserResponse);
    });
  });

  describe('findOne', () => {
    it('returns a user by id', async () => {
      usersService.findOne.mockResolvedValue(mockUserResponse);

      const result = await controller.findOne('user-1');

      expect(usersService.findOne).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockUserResponse);
    });
  });

  describe('create', () => {
    it('creates a new user', async () => {
      const dto = { email: 'new@example.com', password: 'password123', name: 'New User' };
      usersService.create.mockResolvedValue(mockUserResponse);

      const result = await controller.create(dto);

      expect(usersService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockUserResponse);
    });
  });

  describe('update', () => {
    it('updates a user by id', async () => {
      const dto = { name: 'Updated Name' };
      const updatedUser = { ...mockUserResponse, name: 'Updated Name' };
      usersService.update.mockResolvedValue(updatedUser);

      const result = await controller.update('user-1', dto);

      expect(usersService.update).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('updateMe', () => {
    it('updates the current user', async () => {
      const dto = { name: 'New Name' };
      const updatedUser = { ...mockUserResponse, name: 'New Name' };
      usersService.update.mockResolvedValue(updatedUser);

      const result = await controller.updateMe('user-1', dto);

      expect(usersService.update).toHaveBeenCalledWith('user-1', dto);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('deactivate', () => {
    it('deactivates a user', async () => {
      await controller.deactivate('user-2');

      expect(usersService.deactivate).toHaveBeenCalledWith('user-2');
    });
  });

  describe('activate', () => {
    it('activates a user', async () => {
      usersService.activate.mockResolvedValue(mockUserResponse);

      const result = await controller.activate('user-1');

      expect(usersService.activate).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockUserResponse);
    });
  });

  describe('assignRole', () => {
    it('assigns a role to a user', async () => {
      const dto = { roleId: 'role-admin' };
      usersService.assignRole.mockResolvedValue(mockUserResponse);

      const result = await controller.assignRole('user-1', dto);

      expect(usersService.assignRole).toHaveBeenCalledWith('user-1', 'role-admin');
      expect(result).toEqual(mockUserResponse);
    });
  });

  describe('listUserSessions', () => {
    it('returns paginated sessions for the given user', async () => {
      const paginatedSessions: PaginatedResponse<SessionResponseDto> = {
        data: [mockSessionResponse],
        meta: { total: 1, page: 1, limit: 25, totalPages: 1 },
      };
      sessionService.listSessions.mockResolvedValue(paginatedSessions);

      const result = await controller.listUserSessions('user-1', { page: 1, limit: 25 });

      expect(sessionService.listSessions).toHaveBeenCalledWith('user-1', undefined, 1, 25);
      expect(result).toEqual(paginatedSessions);
    });
  });

  describe('terminateUserSession', () => {
    it('terminates a specific session for the given user', async () => {
      await controller.terminateUserSession('user-1', 'session-1');

      expect(sessionService.terminateSession).toHaveBeenCalledWith('session-1', { userId: 'user-1' });
    });
  });

  describe('terminateAllUserSessions', () => {
    it('terminates all sessions for the given user', async () => {
      await controller.terminateAllUserSessions('user-1');

      expect(sessionService.terminateAllSessions).toHaveBeenCalledWith('user-1');
    });
  });
});
