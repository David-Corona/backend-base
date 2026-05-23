import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import { UserNotFoundException, UserAlreadyExistsException } from '@/common/exceptions';
import { RoleNotFoundException } from '@/modules/roles/roles.exceptions';
import { DeactivatedSelfException } from './users.exceptions';
import { UserResponseDto } from '@/common/dto/user-response.dto';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import { paginate } from '@/common/utils/pagination';
import type { CreateUserRequestDto } from './dto/create-user-request.dto';
import type { UpdateUserRequestDto } from './dto/update-user-request.dto';
import { UserStatusFilter } from './dto/users-pagination-query.dto';
import { getViolatedFields } from '@/common/utils/prisma';

function toUserResponseDto(user: {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  isVerified: boolean;
  roleId: string;
  role: { id: string; name: string };
  createdAt: Date;
}): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    isVerified: user.isVerified,
    role: user.role,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findAll(
    page: number,
    limit: number,
    status: UserStatusFilter = UserStatusFilter.ACTIVE,
  ): Promise<PaginatedResponse<UserResponseDto>> {
    const where: Prisma.UserWhereInput = {};
    if (status === UserStatusFilter.ACTIVE) {
      where.isActive = true;
    } else if (status === UserStatusFilter.INACTIVE) {
      where.isActive = false;
    }

    const result = await paginate(
      () => this.prisma.user.count({ where }),
      (skip, take) =>
        this.prisma.user.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          include: { role: { select: { id: true, name: true } } },
        }),
      page,
      limit,
    );

    return {
      data: result.data.map(toUserResponseDto),
      meta: result.meta,
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: { select: { id: true, name: true } } },
    });

    if (!user) {
      throw new UserNotFoundException();
    }

    return toUserResponseDto(user);
  }

  async create(dto: CreateUserRequestDto): Promise<UserResponseDto> {
    const hashedPassword = await hash(dto.password, 12);

    let roleId: string;
    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({
        where: { id: dto.roleId },
        select: { id: true },
      });
      if (!role) {
        throw new RoleNotFoundException();
      }
      roleId = dto.roleId;
    } else {
      roleId = await this.getDefaultRoleId();
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name ?? null,
          password: hashedPassword,
          isVerified: true,
          roleId,
        },
        include: { role: { select: { id: true, name: true } } },
      });

      return toUserResponseDto(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (
          error.code === 'P2002' &&
          getViolatedFields(error.meta).includes('email')
        ) {
          throw new UserAlreadyExistsException();
        }
        if (error.code === 'P2003') {
          throw new RoleNotFoundException();
        }
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateUserRequestDto): Promise<UserResponseDto> {
    const updateData: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) updateData.name = dto.name;

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: updateData,
        include: { role: { select: { id: true, name: true } } },
      });

      return toUserResponseDto(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new UserNotFoundException();
      }
      throw error;
    }
  }

  async deactivate(id: string, currentUserId: string): Promise<void> {
    if (id === currentUserId) {
      throw new DeactivatedSelfException();
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: { isActive: false },
        });

        await tx.session.deleteMany({
          where: { userId: id },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new UserNotFoundException();
      }
      throw error;
    }
  }

  async activate(id: string): Promise<UserResponseDto> {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { isActive: true },
        include: { role: { select: { id: true, name: true } } },
      });

      return toUserResponseDto(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new UserNotFoundException();
      }
      throw error;
    }
  }

  async assignRole(userId: string, roleId: string): Promise<UserResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true },
    });

    if (!role) {
      throw new RoleNotFoundException();
    }

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { roleId },
        include: { role: { select: { id: true, name: true } } },
      });

      return toUserResponseDto(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new UserNotFoundException();
        }
        if (error.code === 'P2003') {
          throw new RoleNotFoundException();
        }
      }
      throw error;
    }
  }

  private async getDefaultRoleId(): Promise<string> {
    const defaultRole = await this.prisma.role.findUnique({
      where: { name: 'user' },
      select: { id: true },
    });

    if (!defaultRole) {
      throw new RoleNotFoundException();
    }

    return defaultRole.id;
  }
}