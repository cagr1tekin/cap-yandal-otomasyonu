import { test } from '@playwright/test';
import { login } from './helpers';

/** Belgelendirme ve görsel kontrol için ekran görüntüleri (docs/ekranlar/). */
const shot = (name: string) => ({ path: `../docs/ekranlar/${name}.png`, fullPage: true });

test('öğrenci ekranları', async ({ page }) => {
  await page.goto('/');
  await page.screenshot(shot('01-ana-sayfa'));
  await login(page, '230201001', '/ogrenci/programlar');
  await page.screenshot(shot('02-ogrenci-programlar'));
  await page.goto('/ogrenci/programlar?tur=YANDAL');
  await page.screenshot(shot('03-ogrenci-yandal'));
  await page.goto('/ogrenci/basvuru/O-2026-GUZ-CAP-IIBF-IKT');
  await page.screenshot(shot('04-ogrenci-basvuru'));
});

test('koordinatör ve birim ekranları', async ({ page }) => {
  await login(page, 'koord.iktisat', '/koordinator');
  await page.screenshot(shot('05-koordinator'));
  await login(page, 'birim.iibf', '/birim/teklifler');
  await page.screenshot(shot('06-birim-teklifler'));
  await page.goto('/birim/takvim');
  await page.screenshot(shot('07-birim-takvim'));
  await page.goto('/raporlar');
  await page.screenshot(shot('08-raporlar'));
  await login(page, 'oidb.yonetici', '/oidb/kurallar');
  await page.screenshot(shot('09-oidb-kurallar'));
});
