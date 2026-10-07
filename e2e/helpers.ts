import { expect, type Page } from '@playwright/test';
import { DEV_PASSWORD } from '@cap/seed-data';

/** Keycloak (yerel deneme realm'i) üzerinden giriş; şifre seed verisindeki deneme şifresidir. */
export async function login(page: Page, username: string, to = '/') {
  await page.context().clearCookies();
  await page.goto(`/giris?donus=${encodeURIComponent(to)}`);
  await page.getByRole('button', { name: /SSO İLE GİRİŞ/ }).click();
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(DEV_PASSWORD);
  await page.locator('#kc-login').click();
  await page.waitForURL((u) => u.host === 'localhost:3000' && !u.pathname.startsWith('/giris') && !u.pathname.startsWith('/api/auth'));
  if (to !== '/') {
    await page.goto(to);
  }
}

/** window.confirm iletişim kutularını kabul eder. */
export function acceptDialogs(page: Page) {
  page.on('dialog', (d) => d.accept());
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByRole('status').filter({ hasText: text }).first()).toBeVisible();
}
