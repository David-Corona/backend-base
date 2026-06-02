import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma-health-indicator';
import { CheckHealthDocs } from './health.docs';

@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly prismaHealthIndicator: PrismaHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @CheckHealthDocs()
  check() {
    return this.healthCheckService.check([
      () => this.prismaHealthIndicator.pingCheck('database'),
    ]);
  }
}
