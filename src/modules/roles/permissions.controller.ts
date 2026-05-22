import { Controller, Get } from '@nestjs/common';
import { RolesService } from '@/modules/roles/roles.service';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@/common/permissions';
import type { PermissionResponseDto } from '@/modules/roles/dto/permission-response.dto';

@Controller('api/permissions')
export class PermissionsController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  async findAll(): Promise<PermissionResponseDto[]> {
    const permissions = await this.rolesService.findAllPermissions();

    return permissions.map((p) => ({
      id: p.id,
      key: p.key,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }
}
