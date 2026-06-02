import { applyDecorators } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse } from '@nestjs/swagger';

export const CheckHealthDocs = () =>
  applyDecorators(
    ApiOperation({
      summary: 'Health check',
      description:
        'Returns the health status of the application and its dependencies. Currently checks database (Prisma) connectivity. Public endpoint — no authentication required.',
    }),
    ApiOkResponse({
      schema: {
        properties: {
          status: {
            type: 'string',
            enum: ['ok', 'error'],
            example: 'ok',
          },
          info: {
            type: 'object',
            nullable: true,
            example: { database: { status: 'up' } },
          },
          error: {
            type: 'object',
            nullable: true,
            example: {},
          },
          details: {
            type: 'object',
            example: { database: { status: 'up' } },
          },
        },
      },
      description: 'Health check completed successfully',
    }),
    ApiServiceUnavailableResponse({
      description:
        'HEALTH_CHECK_FAILED - One or more health checks failed (e.g. database unreachable)',
    }),
  );
