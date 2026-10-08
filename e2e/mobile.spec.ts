import { expect, test } from '@playwright/test';
import { login } from './helpers';

/** Panel telefonda da kullanılabilir: yatay kaydırma yok, menü açılır. */
for (const path of ['/panel', '/birim/basvurular', '/birim/basvurular/yeni?no=230201001&tur=CAP', '/birim/kararlar']) {
  test(`mobil: ${path}`, async ({ page }) => {
    await login(page, 'birim.iibf', path);
    await expect(page.locator('main')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.getByText('Menü', { exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Panel menüsü (mobil)' })).toBeVisible();
  });
}

test('mobil ekran görüntüsü', async ({ page }) => {
  await login(page, 'birim.iibf', '/panel');
  await page.screenshot({ path: '../docs/ekranlar/15-mobil-panel.png' });
});
