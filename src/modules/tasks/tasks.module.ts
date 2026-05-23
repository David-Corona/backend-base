import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '@/modules/auth/auth.module';
import { TasksService } from './tasks.service';

@Module({
  imports: [ScheduleModule.forRoot(), AuthModule],
  providers: [TasksService],
})
export class TasksModule {}
