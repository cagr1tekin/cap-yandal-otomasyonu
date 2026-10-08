import { expect, type Page } from '@playwright/test';
import { DEV_PASSWORD } from '@cap/seed-data';

/** Keycloak (yerel deneme realm'i) üzerinden giriş. */
export async function login(page: Page, username: string, to = '/', password = DEV_PASSWORD) {
  await page.context().clearCookies();
  await page.goto(`/giris?donus=${encodeURIComponent(to)}`);
  await page.getByRole('button', { name: /SSO İLE GİRİŞ/ }).click();
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#kc-login').click();
  await page.waitForURL((u) => u.host === 'localhost:3000' && !u.pathname.startsWith('/giris') && !u.pathname.startsWith('/api/auth'));
  if (to !== '/') await page.goto(to);
}

/** window.confirm iletişim kutularını kabul eder. */
export function acceptDialogs(page: Page) {
  page.on('dialog', (d) => d.accept());
}

/** Mailpit'e düşen son e-postadaki Keycloak işlem bağlantısını döndürür. */
export async function actionLinkFor(email: string) {
  const mailpit = process.env.MAILPIT_URL ?? 'http://localhost:8035';
  for (let i = 0; i < 30; i++) {
    const search = (await (await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json()) as { messages: { ID: string }[] };
    if (search.messages?.length) {
      const msg = (await (await fetch(`${mailpit}/api/v1/message/${search.messages[0].ID}`)).json()) as { Text: string };
      const link = /https?:\/\/localhost:8088\/realms\/selcuk\/login-actions\/action-token\?[^\s"<>]+/.exec(msg.Text)?.[0];
      if (link) return link.replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`E-posta gelmedi: ${email}`);
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Geçerli en küçük PDF (taranmış belge yerine). */
export const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'latin1');
