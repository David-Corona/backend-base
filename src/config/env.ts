import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_ACCESS_TOKEN_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_TOKEN_EXPIRATION: z.string().default('7d'),
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().optional(),
});

export type Env = z.infer<typeof envSchema>;
