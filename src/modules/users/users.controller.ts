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
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@/common/permissions';
import { UserResponseDto } from '@/common/dto/user-response.dto';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import type { CreateUserRequestDto } from './dto/create-user-request.dto';
import type { UpdateUserRequestDto } from './dto/update-user-request.dto';
import type { UpdateProfileRequestDto } from './dto/update-profile-request.dto';
import { UsersPaginationQueryDto } from './dto/users-pagination-query.dto';
import { AssignRoleRequestDto } from './dto/assign-role-request.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  async findAll(
    @Query() pagination: UsersPaginationQueryDto,
  ): Promise<PaginatedResponse<UserResponseDto>> {
    return this.usersService.findAll(pagination);
  }

  @Get('me')
  async findMe(@Req() req: Request): Promise<UserResponseDto> {
    const userId = req.user!.userId;
    return this.usersService.findOne(userId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  async findOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateUserRequestDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }

  @Patch('me')
  async updateMe(
    @Req() req: Request,
    @Body() dto: UpdateProfileRequestDto,
  ): Promise<UserResponseDto> {
    const userId = req.user!.userId;
    return this.usersService.update(userId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserRequestDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const currentUserId = req.user!.userId;
    await this.usersService.deactivate(id, currentUserId);
  }

  @Patch(':id/activate')
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  async activate(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.activate(id);
  }

  @Patch(':id/role')
  @RequirePermissions(PERMISSIONS.USERS_ASSIGN_ROLE)
  async assignRole(
    @Param('id') userId: string,
    @Body() dto: AssignRoleRequestDto,
  ): Promise<UserResponseDto> {
    return this.usersService.assignRole(userId, dto.roleId);
  }
}