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
  RESEND_API_KEY: z.string().min(1),
  FROM_EMAIL: z.string().email(),
});

export type Env = z.infer<typeof envSchema>;
