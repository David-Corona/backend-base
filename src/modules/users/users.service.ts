import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '@/prisma/prisma.service';
import { UserNotFoundException, UserAlreadyExistsException } from '@/common/exceptions';
import { RoleNotFoundException } from '@/modules/roles/roles.exceptions';
import { UserResponseDto } from '@/common/dto/user-response.dto';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import { paginate } from '@/common/utils/pagination';
import type { CreateUserRequestDto } from './dto/create-user-request.dto';
import type { UpdateUserRequestDto } from './dto/update-user-request.dto';
import { UserStatusFilter, UsersPaginationQueryDto } from './dto/users-pagination-query.dto';
import { getViolatedFields } from '@/common/utils/prisma';

const userSelect = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, name: true } },
} as const;

function toUserResponseDto(user: {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  isVerified: boolean;
  role: { id: string; name: string };
  createdAt: Date;
  updatedAt: Date;
}): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    isVerified: user.isVerified,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findAll(
    query: UsersPaginationQueryDto,
  ): Promise<PaginatedResponse<UserResponseDto>> {
    const where: Prisma.UserWhereInput = {};
    const status = query.status ?? UserStatusFilter.ACTIVE;
    if (status === UserStatusFilter.ACTIVE) {
      where.isActive = true;
    } else if (status === UserStatusFilter.INACTIVE) {
      where.isActive = false;
    }

    if (query.name) {
      where.name = { contains: query.name, mode: 'insensitive' };
    }

    if (query.email) {
      where.email = { contains: query.email, mode: 'insensitive' };
    }

    const result = await paginate(
      () => this.prisma.user.count({ where }),
      (skip, take) =>
        this.prisma.user.findMany({
          where,
          skip,
          take,
          orderBy: { createdAt: 'desc' },
          select: userSelect,
        }),
      query.page,
      query.limit,
    );

    return {
      data: result.data.map(toUserResponseDto),
      meta: result.meta,
    };
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSelect,
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
        select: userSelect,
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
        select: userSelect,
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

  async deactivate(id: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id },
          data: { isActive: false },
          select: { id: true },
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
        select: userSelect,
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
        select: userSelect,
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