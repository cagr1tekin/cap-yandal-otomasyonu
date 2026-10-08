import { test } from '@playwright/test';
import { login } from './helpers';

/** Belgelendirme için ekran görüntüleri (docs/ekranlar/). flow.spec.ts sonrası çalışır. */
const shot = (name: string) => ({ path: `../docs/ekranlar/${name}.png`, fullPage: true });

test('öğrenci ekranları', async ({ page }) => {
  await page.goto('/');
  await page.screenshot(shot('01-ana-sayfa'));
  await login(page, '243302013', '/panel');
  await page.screenshot(shot('02-ogrenci-yapilacaklar'));
  await page.goto('/ogrenciler/243302013');
  await page.screenshot(shot('03-ogrenci-durumum'));
  await page.goto('/ogrenciler/243302013?sekme=dersler');
  await page.screenshot(shot('04-ogrenci-dersler'));
  await page.goto('/ogrenciler/243302013?sekme=notlar');
  await page.screenshot(shot('05-ogrenci-donem-sonu-notlari'));
  await page.goto('/ogrenciler/243302013?sekme=belgeler');
  await page.screenshot(shot('06-ogrenci-belgeler'));
});

test('koordinatör ekranları', async ({ page }) => {
  await login(page, 'koord.bilgisayar', '/panel');
  await page.screenshot(shot('07-koordinator-pano'));
  await page.goto('/ogrenciler');
  await page.screenshot(shot('08-ogrenciler'));
  await page.goto('/onaylar');
  await page.screenshot(shot('09-onay-bekleyenler'));
  await page.goto('/ogrenciler/243302013?sekme=dersler');
  await page.screenshot(shot('10-ogrenci-karti-dersler'));
  await page.goto('/ogrenciler/243302015');
  await page.screenshot(shot('11-ogrenci-karti-uyari'));
  await page.goto('/ogrenciler/253303008?sekme=mesajlar');
  await page.screenshot(shot('12-mesajlar'));
  await page.goto('/kontrol');
  await page.screenshot(shot('13-kural-kontrolu'));
  await page.goto('/katalog');
  await page.screenshot(shot('14-ders-katalogu'));
  await page.goto('/kurallar');
  await page.screenshot(shot('15-yonerge-kurallari'));
  await page.goto('/iceri-aktar');
  await page.screenshot(shot('16-iceri-aktar'));
  await page.goto('/kullanicilar');
  await page.screenshot(shot('17-hesaplar'));
  await page.goto('/yazdir/protokol/243302013');
  await page.screenshot(shot('18-protokol-formu-yazdir'));
});

test('bölüm başkanı ekranları', async ({ page }) => {
  await login(page, 'bolum.bilgisayar', '/denetim');
  await page.screenshot(shot('19-islem-kaydi'));
  await page.goto('/ogrenciler/243302013?sekme=gecmis');
  await page.screenshot(shot('20-kart-islem-gecmisi'));
});
