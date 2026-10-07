import { existsSync } from 'node:fs';
import { z } from 'zod';

// Yerel geliştirmede apps/api/.env dosyası okunur (Node 22 yerleşik).
if (existsSync('.env') && process.env.NODE_ENV !== 'test') process.loadEnvFile('.env');

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url(),
  OIDC_ISSUER: z.string().url(),
  OIDC_AUDIENCE: z.string().min(1),
  OBIS_ADAPTER: z.enum(['mock', 'http']).default('mock'),
  OBIS_BASE_URL: z.string().url(),
  OBIS_API_KEY: z.string().min(1),
  OBIS_PORTAL_URL: z.string().url().default('http://localhost:4100/obis'),
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().default(1035),
  MAIL_FROM: z.string().default('ÇAP-Yan Dal Sistemi <noreply@cap.test>'),
  WORKER_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  LOG_PRETTY: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  NODE_ENV: z.string().default('development'),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Geçersiz ortam değişkenleri: ${msg}`);
  }
  return parsed.data;
}

export const APP_CONFIG = Symbol('APP_CONFIG');
