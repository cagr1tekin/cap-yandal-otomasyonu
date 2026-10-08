import { defineConfig, devices } from '@playwright/test';

/**
 * Önkoşul: altyapı (docker compose), API ve web çalışıyor olmalı; veritabanı her koşuda seed durumuna döner.
 * Ayrıntı: README "Uçtan uca test".
 */
export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './global-setup.ts',
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:3000',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'flow', testMatch: 'flow.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'screens', testMatch: 'screens.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', testMatch: 'mobile.spec.ts', use: { ...devices['Pixel 7'] } },
  ],
});
