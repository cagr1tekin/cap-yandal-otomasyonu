import { test } from '@playwright/test';
import { login } from './helpers';

/** Belgelendirme için ekran görüntüleri (docs/ekranlar/). flow.spec.ts sonrası çalışır; veriler dolu olur. */
const shot = (name: string) => ({ path: `../docs/ekranlar/${name}.png`, fullPage: true });

test('öğrenci ekranları', async ({ page }) => {
  await page.goto('/');
  await page.screenshot(shot('01-ana-sayfa'));
  await login(page, '253302004', '/panel');
  await page.screenshot(shot('02-ogrenci-gorevlerim'));
  await page.goto('/ogrenci/bilgilerim');
  await page.screenshot(shot('03-ogrenci-bilgilerim'));
  await login(page, '253302003', '/ogrenci/basvuru');
  await page.screenshot(shot('04-ogrenci-uygunluk-ve-basvuru'));
  await login(page, '253302001', '/ogrenci/kayitlarim');
  await page.getByRole('link', { name: 'Bilgisayar Mühendisliği Çift Ana Dal' }).click();
  await page.waitForURL(/\/kayitlar\//);
  await page.screenshot(shot('05-kayit-protokol-ders-kaydi-muafiyet'));
  const enrollment = new URL(page.url()).pathname.split('/').pop();
  await page.goto(`/yazdir/protokol/${enrollment}`);
  await page.screenshot(shot('06-protokol-formu-yazdir'));
  await page.goto(`/yazdir/ders-kayit/${enrollment}`);
  await page.screenshot(shot('07-ders-kayit-formu-yazdir'));
});

test('komisyon ve yönetim ekranları', async ({ page }) => {
  await login(page, 'koord.bilgisayar', '/panel');
  await page.screenshot(shot('08-koordinator-gorevlerim'));
  await page.goto('/koordinator/donem');
  await page.screenshot(shot('09-kontenjan-ve-takvim'));
  await page.goto('/koordinator/basvurular');
  await page.screenshot(shot('10-basvurular'));
  await page.locator('tbody tr').first().getByRole('link').click();
  await page.waitForURL(/\/koordinator\/basvurular\/.+/);
  await page.screenshot(shot('11-beyan-dogrulama'));
  await page.goto('/koordinator/degerlendirme/O-2026-GUZ-CAP');
  await page.screenshot(shot('12-siralama-ve-karar'));
  await page.goto('/koordinator/ogrenciler');
  await page.screenshot(shot('13-ogrenciler'));
  await page.goto('/koordinator/protokoller/PT-CAP-EEM');
  await page.screenshot(shot('14-protokol-sablonu'));
  await page.goto('/koordinator/taramalar');
  await page.locator('tbody tr').first().getByRole('link', { name: 'Aç' }).click();
  await page.waitForURL(/\/koordinator\/taramalar\/.+/);
  await page.screenshot(shot('15-donem-sonu-taramasi'));
  await page.goto('/belgeler');
  await page.screenshot(shot('16-yonerge-ve-formlar'));

  await login(page, 'bolum.bilgisayar', '/yonetim/kullanicilar');
  await page.screenshot(shot('17-kullanicilar-ve-roller'));
  await page.goto('/yonetim/denetim');
  await page.screenshot(shot('18-denetim-kaydi'));
  await page.goto('/raporlar');
  await page.screenshot(shot('19-raporlar'));
  await login(page, 'danisman.eem', '/onaylar');
  await page.screenshot(shot('20-imzalarim'));
});
