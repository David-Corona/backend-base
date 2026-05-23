import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { getViolatedFields } from '@/common/utils/prisma';
import { paginate } from '@/common/utils/pagination';
import {
  RoleNotFoundException,
  RoleAlreadyExistsException,
  RoleInUseException,
  RoleProtectedException,
  InvalidPermissionsException,
} from './roles.exceptions';
import type { CreateRoleRequestDto } from './dto/create-role-request.dto';
import type { UpdateRoleRequestDto } from './dto/update-role-request.dto';
import type { RoleResponseDto } from './dto/role-response.dto';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import type { PermissionResponseDto } from '@/modules/roles/dto/permission-response.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoleRequestDto): Promise<RoleResponseDto> {
    try {
      const role = await this.prisma.$transaction(async (tx) => {
        const newRole = await tx.role.create({
          data: {
            name: dto.name,
            description: dto.description,
          },
        });

        if (dto.permissions.length > 0) {
          const permissions = await tx.permission.findMany({
            where: { key: { in: dto.permissions } },
            select: { id: true },
          });

          if (permissions.length !== dto.permissions.length) {
            throw new InvalidPermissionsException();
          }

          await tx.rolePermission.createMany({
            data: permissions.map((p) => ({
              roleId: newRole.id,
              permissionId: p.id,
            })),
          });
        }

        return newRole;
      });

      return this.findOne(role.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        getViolatedFields(error.meta).includes('name')
      ) {
        throw new RoleAlreadyExistsException();
      }
      throw error;
    }
  }

  async findAll(
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<RoleResponseDto>> {
    const roleInclude = {
      permissions: {
        include: {
          permission: { select: { key: true } },
        },
      },
    } as const;

    const result = await paginate(
      () => this.prisma.role.count(),
      (skip, take) =>
        this.prisma.role.findMany({
          skip,
          take,
          include: roleInclude,
          orderBy: { createdAt: 'desc' },
        }),
      page,
      limit,
    );

    return {
      data: result.data.map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions.map((rp) => rp.permission.key),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      })),
      meta: result.meta,
    };
  }

  async findOne(id: string): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: { select: { key: true } },
          },
        },
      },
    });

    if (!role) {
      throw new RoleNotFoundException();
    }

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: role.permissions.map((rp) => rp.permission.key),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }

  async update(id: string, dto: UpdateRoleRequestDto): Promise<RoleResponseDto> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.findUnique({
          where: { id },
          select: { id: true },
        });

        if (!role) {
          throw new RoleNotFoundException();
        }

        const updateData: Prisma.RoleUpdateInput = {};
        if (dto.name !== undefined) updateData.name = dto.name;
        if (dto.description !== undefined) updateData.description = dto.description;

        if (Object.keys(updateData).length > 0) {
          await tx.role.update({
            where: { id },
            data: updateData,
          });
        }

        if (dto.permissions !== undefined) {
          await tx.rolePermission.deleteMany({
            where: { roleId: id },
          });

          if (dto.permissions.length > 0) {
            const permissions = await tx.permission.findMany({
              where: { key: { in: dto.permissions } },
              select: { id: true },
            });

            if (permissions.length !== dto.permissions.length) {
              throw new InvalidPermissionsException();
            }

            await tx.rolePermission.createMany({
              data: permissions.map((p) => ({
                roleId: id,
                permissionId: p.id,
              })),
            });
          }
        }
      });

      return this.findOne(id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        getViolatedFields(error.meta).includes('name')
      ) {
        throw new RoleAlreadyExistsException();
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({
        where: { id },
        select: { name: true },
      });

      if (!role) {
        throw new RoleNotFoundException();
      }

      if (['admin', 'user'].includes(role.name)) {
        throw new RoleProtectedException();
      }

      const usersWithRole = await tx.user.count({
        where: { roleId: id },
      });

      if (usersWithRole > 0) {
        throw new RoleInUseException();
      }

      await tx.role.delete({
        where: { id },
      });
    });
  }

  /**
   * Returns permission keys for a given role.
   * If the role does not exist, returns an empty array (fail-closed).
   */
  async getPermissionsForRole(roleId: string): Promise<string[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: { select: { key: true } },
      },
    });

    return rolePermissions.map((rp) => rp.permission.key);
  }

  async findAllPermissions(
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<PermissionResponseDto>> {
    return paginate(
      () => this.prisma.permission.count(),
      (skip, take) =>
        this.prisma.permission.findMany({
          skip,
          take,
          orderBy: { key: 'asc' },
        }),
      page,
      limit,
    );
  }
}
