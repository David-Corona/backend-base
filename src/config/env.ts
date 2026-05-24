import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_ACCESS_TOKEN_EXPIRATION: z.string().regex(/^\d+[dhms]$/).default('15m'),
  JWT_REFRESH_TOKEN_EXPIRATION: z.string().regex(/^\d+[dhms]$/).default('7d'),
  PASSWORD_RESET_TOKEN_EXPIRATION: z.string().regex(/^\d+[dhms]$/).default('1h'),
  EMAIL_VERIFICATION_TOKEN_EXPIRATION: z.string().regex(/^\d+[dhms]$/).default('24h'),
  RATE_LIMIT_TTL: z.coerce.number().default(60000),
  RATE_LIMIT_DEFAULT: z.coerce.number().default(60),
  RATE_LIMIT_AUTH: z.coerce.number().default(10),
  RESEND_API_KEY: z.string().min(1),
  FROM_EMAIL: z.string().email(),
  LOG_REQUEST_BODIES: z.enum(['true', 'false']).optional(),
});

export type Env = z.infer<typeof envSchema>;
