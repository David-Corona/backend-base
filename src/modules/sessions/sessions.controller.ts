import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@/common/permissions';
import { SessionService } from './session.service';
import { AdminSessionResponseDto } from './dto/admin-session-response.dto';
import { SessionsPaginationQueryDto } from './dto/sessions-pagination-query.dto';
import { TerminateUserSessionsDto } from './dto/terminate-user-sessions.dto';
import type { PaginatedResponse } from '@/common/dto/paginated-response.dto';
import {
  ListAllSessionsDocs,
  GetSessionByIdDocs,
  TerminateSessionDocs,
  TerminateUserSessionsDocs,
} from './sessions.docs';

@ApiTags('Sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  @ListAllSessionsDocs()
  async findAll(
    @Query() filters: SessionsPaginationQueryDto,
  ): Promise<PaginatedResponse<AdminSessionResponseDto>> {
    return this.sessionService.listAllSessions(
      {
        userId: filters.userId,
        ip: filters.ip,
        userAgent: filters.userAgent,
        includeExpired: filters.includeExpired,
        createdAfter: filters.createdAfter,
        createdBefore: filters.createdBefore,
      },
      filters.page,
      filters.limit,
    );
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SESSIONS_READ)
  @GetSessionByIdDocs()
  async findOne(@Param('id') id: string): Promise<AdminSessionResponseDto> {
    return this.sessionService.findSessionById(id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.SESSIONS_TERMINATE)
  @TerminateSessionDocs()
  @HttpCode(HttpStatus.NO_CONTENT)
  async terminate(@Param('id') id: string): Promise<void> {
    await this.sessionService.terminateSession(id);
  }

  @Delete()
  @RequirePermissions(PERMISSIONS.SESSIONS_TERMINATE)
  @TerminateUserSessionsDocs()
  @HttpCode(HttpStatus.NO_CONTENT)
  async terminateByUser(@Query() dto: TerminateUserSessionsDto): Promise<void> {
    await this.sessionService.terminateAllSessions(dto.userId);
  }
}
