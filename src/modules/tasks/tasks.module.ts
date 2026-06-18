import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '@/modules/auth/auth.module';
import { SessionsModule } from '@/modules/sessions/sessions.module';
import { TasksService } from './tasks.service';

@Module({
  imports: [ScheduleModule.forRoot(), AuthModule, SessionsModule],
  providers: [TasksService],
})
export class TasksModule {}
