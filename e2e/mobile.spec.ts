import { expect, test } from '@playwright/test';
import { login } from './helpers';

/** Öğrenci ekranları telefonda da kullanılabilir: yatay kaydırma yok, menü açılır. */
for (const path of ['/panel', '/ogrenci/bilgilerim', '/ogrenci/basvuru', '/ogrenci/kayitlarim', '/belgeler']) {
  test(`mobil: ${path}`, async ({ page }) => {
    await login(page, '253302004', path);
    await expect(page.locator('main')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByText('Menü', { exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Panel menüsü (mobil)' })).toBeVisible();
  });
}

test('mobil ekran görüntüsü', async ({ page }) => {
  await login(page, '253302004', '/ogrenci/basvuru');
  await page.screenshot({ path: '../docs/ekranlar/21-mobil-basvuru.png' });
});
