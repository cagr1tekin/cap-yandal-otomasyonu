import { test } from '@playwright/test';
import { login } from './helpers';

/** Belgelendirme için ekran görüntüleri (docs/ekranlar/). flow.spec.ts sonrası çalışır; veriler dolu olur. */
const shot = (name: string) => ({ path: `../docs/ekranlar/${name}.png`, fullPage: true });

test('personel paneli ekranları', async ({ page }) => {
  await page.goto('/');
  await page.screenshot(shot('01-giris-sayfasi'));
  await login(page, 'birim.iibf', '/panel');
  await page.screenshot(shot('02-birim-gorevlerim'));
  await page.goto('/birim/basvurular');
  await page.screenshot(shot('03-birim-basvurular'));
  await page.goto('/birim/basvurular/yeni?no=230301004&tur=CAP&teklif=O-2026-GUZ-CAP-IIBF-IKT');
  await page.screenshot(shot('04-basvuru-girisi'));
  await page.goto('/birim/kararlar/O-2026-GUZ-CAP-IIBF-IKT');
  await page.screenshot(shot('05-karar-ve-kesin-kayit'));
  await page.goto('/birim/ders-kayitlari');
  await page.screenshot(shot('06-ders-kayit-formlari'));

  await login(page, 'koord.iktisat', '/koordinator/O-2026-GUZ-CAP-IIBF-IKT/ogrenciler');
  await page.screenshot(shot('07-koordinator-ogrenciler'));
  await page.getByRole('link', { name: 'Ayşe Demirtaş' }).click();
  await page.waitForURL(/\/kayitlar\//);
  await page.screenshot(shot('08-kayit-protokol-ders-kaydi'));
  const enrollment = new URL(page.url()).pathname.split('/').pop();
  await page.goto(`/yazdir/protokol/${enrollment}`);
  await page.screenshot(shot('09-protokol-formu-yazdir'));

  await login(page, 'danisman.isletme', '/danisman');
  await page.screenshot(shot('10-danisman'));

  await login(page, 'oidb.yonetici', '/panel');
  await page.screenshot(shot('11-oidb-gorevlerim'));
  await page.goto('/oidb/kullanicilar');
  await page.screenshot(shot('12-kullanicilar-roller'));
  await page.goto('/oidb/denetim');
  await page.screenshot(shot('13-denetim-kaydi'));
  await page.goto('/yazdir/kontenjan');
  await page.screenshot(shot('14-kontenjan-ilani'));
});
