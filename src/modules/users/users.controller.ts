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
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { SessionService } from '@/modules/auth/session.service';
import { NotSelfGuard } from '@/common/guards/not-self.guard';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PERMISSIONS } from '@/common/permissions';
import { UserResponseDto } from '@/common/dto/user-response.dto';
import { SessionResponseDto } from '@/common/dto/session-response.dto';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import { CreateUserRequestDto } from './dto/create-user-request.dto';
import { UpdateUserRequestDto } from './dto/update-user-request.dto';
import { UpdateProfileRequestDto } from './dto/update-profile-request.dto';
import { UsersPaginationQueryDto } from './dto/users-pagination-query.dto';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { AssignRoleRequestDto } from './dto/assign-role-request.dto';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  async findAll(
    @Query() pagination: UsersPaginationQueryDto,
  ): Promise<PaginatedResponse<UserResponseDto>> {
    return this.usersService.findAll(pagination);
  }

  @Get('me')
  async findMe(@CurrentUser('userId') userId: string): Promise<UserResponseDto> {
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
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateProfileRequestDto,
  ): Promise<UserResponseDto> {
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
  @UseGuards(NotSelfGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deactivate(@Param('id') id: string): Promise<void> {
    await this.usersService.deactivate(id);
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

  @Get(':userId/sessions')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  async listUserSessions(
    @Param('userId') userId: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<SessionResponseDto>> {
    return this.sessionService.listSessions(userId, undefined, pagination.page, pagination.limit);
  }

  @Delete(':userId/sessions/:id')
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async terminateUserSession(
    @Param('userId') userId: string,
    @Param('id') sessionId: string,
  ): Promise<void> {
    await this.sessionService.terminateSession(sessionId, { userId });
  }

  @Delete(':userId/sessions')
  @RequirePermissions(PERMISSIONS.USERS_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async terminateAllUserSessions(
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.sessionService.terminateAllSessions(userId);
  }
}