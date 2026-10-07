import { expect, test } from '@playwright/test';
import { acceptDialogs, login } from './helpers';

/**
 * Teknik doküman bölüm 12: uygunluk → başvuru → sıralama → karar → yayın → kayıt → tarama → kayıt silme.
 * Tüm adımlar arayüzden yapılır (Keycloak girişi dahil).
 */
test.describe.configure({ mode: 'serial' });

const IKT = 'O-2026-GUZ-CAP-IIBF-IKT';

test('öğrenci uygunluğu gerekçesiyle görür ve başvurur', async ({ page }) => {
  await login(page, '230201001', '/ogrenci/programlar');
  const card = page.locator('section').filter({ has: page.getByRole('heading', { name: 'İşletme', exact: true }) });
  await expect(card.getByText('Kendi ana dal programına başvurulamaz.').first()).toBeVisible();

  await page.goto(`/ogrenci/basvuru/${IKT}`);
  await page.getByRole('button', { name: 'Başvuruyu gönder' }).click();
  // Onay kutusu işaretlenmeden tarayıcı formu göndermez
  await expect(page).toHaveURL(new RegExp(`/ogrenci/basvuru/${IKT}`));
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Başvuruyu gönder' }).click();
  await expect(page).toHaveURL(/basvurularim\?gonderildi=1/);
  await expect(page.getByText('Başvurunuz alındı.')).toBeVisible();
  await expect(page.getByText('İktisat', { exact: true })).toBeVisible();
});

test('YKS yolu: yanlış kod reddedilir, doğru kodla başvuru alınır', async ({ page }) => {
  await login(page, '230301004', `/ogrenci/basvuru/${IKT}`);
  await expect(page.getByText('Taban puan yoluyla başvuruyorsunuz')).toBeVisible();
  await page.getByLabel('Sonuç belgesi numarası').fill('YKS2025-0001234');
  await page.getByLabel('Doğrulama kodu').fill('YANLIS');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Başvuruyu gönder' }).click();
  await expect(page.getByText('ÖSYM sonuç belgesi doğrulanamadı')).toBeVisible();
  await page.getByLabel('Doğrulama kodu').fill('AB12CD');
  await page.getByRole('button', { name: 'Başvuruyu gönder' }).click();
  await expect(page).toHaveURL(/basvurularim/);
});

test('daha yüksek GNO\'lu iki öğrenci başvurur', async ({ page }) => {
  for (const s of ['230201030', '230201031']) {
    await login(page, s, `/ogrenci/basvuru/${IKT}`);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Başvuruyu gönder' }).click();
    await expect(page).toHaveURL(/basvurularim/);
  }
});

test('birim başvuru dönemini kapatır', async ({ page }) => {
  acceptDialogs(page);
  await login(page, 'birim.iibf', '/birim/takvim');
  const card = page.locator('section').filter({ hasText: 'Çift Ana Dal' }).filter({ hasText: 'İktisadi ve İdari Bilimler' });
  await card.getByRole('button', { name: 'Başvuruyu şimdi kapat' }).click();
  await expect(page.getByText('Başvuru dönemi kapatıldı.')).toBeVisible();
});

test('koordinatör sıralamayı görür ve öneriyi kilitler', async ({ page }) => {
  acceptDialogs(page);
  await login(page, 'koord.iktisat', `/koordinator/${IKT}`);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(4);
  await expect(rows.nth(0)).toContainText('Büşra Yalçın');
  await expect(rows.nth(3)).toContainText('Emre Yıldırım');
  await expect(rows.nth(3)).toContainText('ÖSYM doğrulandı');
  await page.getByRole('button', { name: 'Öneriyi kilitle ve birime gönder' }).click();
  await expect(page.getByText(/tarihinde kilitlendi/)).toBeVisible();
});

test('birim kararı girer ve sonuçları yayımlar', async ({ page }) => {
  acceptDialogs(page);
  await login(page, 'birim.iibf', `/birim/kararlar/${IKT}`);
  await page.getByLabel('Karar sayısı').fill('2026/45-3');
  await page.getByRole('button', { name: 'Kararı kaydet' }).click();
  await expect(page.getByText(/Karar 2026\/45-3/)).toBeVisible();
  await page.getByRole('button', { name: 'Sonuçları yayımla' }).click();
  await expect(page.getByText(/tarihinde yayımlandı/)).toBeVisible();
});

test('öğrenci sonucu ve bildirimi görür, OBİS\'te kesin kayıt yapar', async ({ page }) => {
  await login(page, '230201001', '/ogrenci/basvurularim');
  await expect(page.getByText('Kabul (asil)')).toBeVisible();
  await expect(page.getByText('2026/45-3')).toBeVisible();
  await page.goto('/bildirimler');
  await expect(page.getByText('Başvuru sonucunuz ilan edildi')).toBeVisible();

  // Sahte OBİS ekranı: kesin kayıt OBİS'te yapılır
  await page.goto('http://localhost:4100/obis');
  await page.getByLabel('Öğrenci numarası').fill('230201001');
  await page.getByLabel('Program').selectOption('P-IIBF-IKT');
  await page.getByRole('button', { name: 'Kesin kaydı tamamla' }).click();
  await expect(page.getByText("Kesin kayıt OBİS'e işlendi.")).toBeVisible();
});

test('birim OBİS\'ten kayıtları eşitler; öğrencinin kaydı etkinleşir', async ({ page }) => {
  await login(page, 'birim.iibf', `/birim/kararlar/${IKT}`);
  await page.getByRole('button', { name: "OBİS'ten kayıtları eşitle" }).click();
  await expect(page.getByText(/1 yeni kayıt/)).toBeVisible();

  await login(page, '230201001', '/ogrenci/programlarim');
  await expect(page.getByRole('heading', { name: /İktisat/ })).toBeVisible();
  await expect(page.getByText('Etkin', { exact: true })).toBeVisible();
});

test('dönem sonu taraması kayıt silme adayını bulur; birim onaylar', async ({ page }) => {
  acceptDialogs(page);
  await login(page, 'birim.iibf', '/birim/taramalar');
  await page.getByRole('button', { name: 'Taramayı başlat' }).click();
  await expect(page).toHaveURL(/\/birim\/taramalar\/.+/);
  const finding = page.locator('section').filter({ hasText: 'Can Polat' });
  await expect(finding).toBeVisible({ timeout: 30_000 });
  await expect(finding).toContainText('KR-YD-06');
  await finding.getByLabel(/Gerekçe/).fill('Yönetim kurulu 2026/46-2');
  await finding.getByRole('button', { name: 'Onayla (kaydı sil)' }).click();
  await expect(finding.getByText(/Onaylandı — birim.iibf/)).toBeVisible();

  await login(page, '220301008', '/ogrenci/programlarim');
  await expect(page.getByText('Kaydı silindi')).toBeVisible();
});

test('ÇAP\'tan ayrılan öğrenci yan dal sertifikası hakkını görür', async ({ page }) => {
  acceptDialogs(page);
  await login(page, '220401011', '/ogrenci/programlarim');
  await page.getByText('Programdan ayrıl').click();
  await page.getByLabel('Gerekçe').fill('Ana dala odaklanmak istiyorum');
  await page.getByRole('button', { name: 'Ayrılmayı onayla' }).click();
  await expect(page.getByText('yan dal sertifikasına hak kazanırsınız')).toBeVisible();
});

test('yetkisiz erişim: öğrenci personel sayfasına giremez', async ({ page }) => {
  await login(page, '230201002', '/birim/kararlar');
  await expect(page).not.toHaveURL(/\/birim\//);
});
