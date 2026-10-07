import { expect, test } from '@playwright/test';
import { login } from './helpers';

/** PRD 7.3: öğrenci ekranları telefonda tam çalışır (yatay kaydırma yok). */
for (const path of ['/ogrenci/programlar', '/ogrenci/basvurularim', '/ogrenci/programlarim', '/bildirimler']) {
  test(`mobil: ${path}`, async ({ page }) => {
    await login(page, '230201001', path);
    await expect(page.locator('main')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole('navigation', { name: 'Ana menü' }).first()).toBeVisible();
  });
}

test('mobil ekran görüntüsü', async ({ page }) => {
  await login(page, '230201001', '/ogrenci/programlar');
  await page.screenshot({ path: '../docs/ekranlar/10-mobil-programlar.png' });
});
