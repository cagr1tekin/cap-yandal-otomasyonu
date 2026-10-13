import { existsSync } from 'node:fs';
import { z } from 'zod';

// Yerel geliştirmede apps/api/.env dosyası okunur (Node 22 yerleşik).
if (existsSync('.env') && process.env.NODE_ENV !== 'test') process.loadEnvFile('.env');

const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PORT: z.coerce.number().default(4000),
  /** Yerelde yalnızca 127.0.0.1; barındırmada (Render) 0.0.0.0. */
  HOST: z.string().default('127.0.0.1'),
  WEB_ORIGIN: z.string().url(),
  /** Oturum belirteçlerinin imza anahtarı (en az 32 karakter, rastgele). */
  AUTH_SECRET: z.string().min(32),
  /** Öğrencilerin yüklediği belgelerin tutulduğu dizin (sürüm denetimine girmez). */
  UPLOAD_DIR: z.string().default('./storage'),
  /** Belge içeriğinin yeri: disk (UPLOAD_DIR) ya da veritabanı (kalıcı diski olmayan barındırma). */
  STORAGE_DRIVER: z.enum(['disk', 'db']).default('disk'),
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().default(1035),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('Bilgisayar Müh. ÇAP-YDP <noreply@cap.test>'),
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
