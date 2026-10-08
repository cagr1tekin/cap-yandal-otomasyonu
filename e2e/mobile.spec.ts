import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll, login } from './helpers';

/** Öğrenci ekranları telefonda da kullanılabilir: yatay kaydırma yok, menü açılır. */
const NO = '253302009';
for (const path of ['/panel', `/ogrenciler/${NO}`, `/ogrenciler/${NO}?sekme=dersler`, `/ogrenciler/${NO}?sekme=belgeler`, `/ogrenciler/${NO}?sekme=mesajlar`]) {
  test(`mobil: ${path}`, async ({ page }) => {
    await login(page, NO, path);
    await expect(page.locator('main')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByText('Menü', { exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Panel menüsü (mobil)' })).toBeVisible();
  });
}

test('mobil ekran görüntüsü', async ({ page }) => {
  await login(page, NO, `/ogrenciler/${NO}?sekme=dersler`);
  await page.screenshot({ path: '../docs/ekranlar/21-mobil-dersler.png' });
});
