import { Module } from '@nestjs/common';
import { SessionsModule } from '@/modules/sessions/sessions.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SessionsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}