import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolesService } from '@/modules/roles/roles.service';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@/common/permissions';
import { PermissionsPaginationQueryDto } from '@/modules/roles/dto/permissions-pagination-query.dto';
import type { PermissionResponseDto } from '@/modules/roles/dto/permission-response.dto';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import { GetPermissionsDocs } from './permissions.docs';

@ApiTags('Permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @GetPermissionsDocs()
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  async findAll(
    @Query() pagination: PermissionsPaginationQueryDto,
  ): Promise<PaginatedResponse<PermissionResponseDto>> {
    return this.rolesService.findAllPermissions(pagination.page, pagination.limit);
  }
}
