import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@/common/permissions';
import { RolesPaginationQueryDto } from './dto/roles-pagination-query.dto';
import { CreateRoleRequestDto } from './dto/create-role-request.dto';
import { UpdateRoleRequestDto } from './dto/update-role-request.dto';
import { RoleResponseDto } from './dto/role-response.dto';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import {
  GetRolesDocs,
  GetRoleByIdDocs,
  CreateRoleDocs,
  UpdateRoleDocs,
  DeleteRoleDocs,
} from './roles.docs';

@ApiTags('Roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @GetRolesDocs()
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  async findAll(
    @Query() pagination: RolesPaginationQueryDto,
  ): Promise<PaginatedResponse<RoleResponseDto>> {
    return this.rolesService.findAll(pagination.page, pagination.limit);
  }

  @Get(':id')
  @GetRoleByIdDocs()
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  async findOne(@Param('id') id: string): Promise<RoleResponseDto> {
    return this.rolesService.findOne(id);
  }

  @Post()
  @CreateRoleDocs()
  @RequirePermissions(PERMISSIONS.ROLES_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateRoleRequestDto): Promise<RoleResponseDto> {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @UpdateRoleDocs()
  @RequirePermissions(PERMISSIONS.ROLES_WRITE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleRequestDto,
  ): Promise<RoleResponseDto> {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @DeleteRoleDocs()
  @RequirePermissions(PERMISSIONS.ROLES_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.rolesService.remove(id);
  }
}
