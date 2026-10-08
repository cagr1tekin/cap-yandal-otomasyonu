import { expect, test, type Page } from '@playwright/test';
import { acceptDialogs, login } from './helpers';

/**
 * Rol bazlı personel paneli — arayüzden uçtan uca (Keycloak girişi dahil):
 * başvuru girişi → pencere kapanışı → sıralama/kilit → karar/yayın → kesin kayıt
 * → protokol (5 imza) → dosyalama → dönemlik ders kaydı → toplu teslim → OBİS listesi.
 */
test.describe.configure({ mode: 'serial' });

const IKT = 'O-2026-GUZ-CAP-IIBF-IKT';
let enrollmentUrl = '';

async function enterApplication(page: Page, studentNo: string, documentNo: string) {
  await page.goto(`/birim/basvurular/yeni?no=${studentNo}&tur=CAP&teklif=${IKT}`);
  await page.getByLabel('Evrak kayıt numarası').fill(documentNo);
  await page.getByRole('button', { name: 'Başvuruyu kaydet' }).click();
  await page.waitForURL(/\/birim\/basvurular\/[^/]+\?kaydedildi=1/);
}

async function approveAll(page: Page, user: string) {
  await login(page, user, '/onaylar');
  // Onaylanan imza listeden düşer; bekleyen kalmayana kadar ilk kartı onayla.
  const buttons = page.getByRole('button', { name: /^(Onayla|Öğrencinin ıslak imzası alındı)$/ });
  // Saymadan önce sayfa içeriğinin gelmesini bekle (kartlar ya da "bekleyen yok" mesajı).
  await expect(page.getByText(/İmzanız:|İmzanızı bekleyen form yok/).first()).toBeVisible();
  for (let n = await buttons.count(); n > 0; n--) {
    await buttons.first().click();
    await expect(buttons).toHaveCount(n - 1);
  }
}

test('birim öğrenci işleri dilekçeleri panele girer (uygunluk + belge kontrolü)', async ({ page }) => {
  await login(page, 'birim.iibf', '/birim/basvurular/yeni');
  await page.getByLabel('Öğrenci numarası').fill('230201001');
  await page.getByRole('button', { name: "OBİS'ten getir" }).click();
  await expect(page.getByText('Ayşe Demirtaş · 230201001')).toBeVisible();
  const ikt = page.locator('li').filter({ hasText: 'İktisat' });
  await expect(ikt.getByText('Uygun', { exact: true })).toBeVisible();
  await ikt.getByRole('link', { name: 'Seç' }).click();

  // Zorunlu belge işareti kaldırılırsa kayıt reddedilir
  await page.getByLabel('Evrak kayıt numarası').fill('E-2026/1001');
  await page.getByRole('checkbox', { name: /Öğrenci işlerinden/ }).uncheck();
  await page.getByRole('button', { name: 'Başvuruyu kaydet' }).click();
  await expect(page.getByText('Zorunlu belgeler eksik; başvuru işleme alınamaz.')).toBeVisible();
  await page.getByRole('checkbox', { name: /Öğrenci işlerinden/ }).check();
  await page.getByRole('button', { name: 'Başvuruyu kaydet' }).click();
  await expect(page.getByText('Başvuru kaydedildi.')).toBeVisible();

  await enterApplication(page, '230201030', 'E-2026/1002');
  await enterApplication(page, '230201031', 'E-2026/1003');
  await enterApplication(page, '230201003', 'E-2026/1004');
  await expect(page.getByText('Başvuru kayda alındı: koşulları sağlamıyor.')).toBeVisible();
  await expect(page.getByText('GNO 2,74 < 2,75')).toBeVisible();
});

test('birim başvuru dönemini kapatır; koordinatör sıralamayı kilitler', async ({ page }) => {
  acceptDialogs(page);
  await login(page, 'birim.iibf', '/birim/takvim');
  const card = page.locator('section').filter({ hasText: 'Çift Ana Dal' }).filter({ hasText: 'İktisadi ve İdari Bilimler' });
  await card.getByRole('button', { name: 'Başvuruyu şimdi kapat' }).click();
  await expect(page.getByText('Başvuru dönemi kapatıldı.')).toBeVisible();

  await login(page, 'koord.iktisat', `/koordinator/${IKT}`);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Büşra Yalçın');
  await page.getByRole('button', { name: 'Öneriyi kilitle ve birime gönder' }).click();
  await expect(page.getByText(/tarihinde kilitlendi/)).toBeVisible();
});

test('birim kararı girer, yayımlar ve kesin kaydı belge kontrolüyle yapar', async ({ page }) => {
  acceptDialogs(page);
  await login(page, 'birim.iibf', `/birim/kararlar/${IKT}`);
  await page.getByLabel('Karar sayısı').fill('2026/45-3');
  await page.getByRole('button', { name: 'Kararı kaydet' }).click();
  await expect(page.getByText(/Karar 2026\/45-3/)).toBeVisible();
  await page.getByRole('button', { name: 'Sonuçları yayımla' }).click();
  await expect(page.getByText(/tarihinde yayımlandı/)).toBeVisible();

  const row = page.locator('details').filter({ hasText: 'Ayşe Demirtaş' });
  await row.locator('summary').click();
  for (const box of await row.getByRole('checkbox').all()) await box.check();
  await row.getByRole('button', { name: 'Kesin kaydı yap' }).click();
  await expect(page.getByText(/Kesin kayıt yapıldı/)).toBeVisible();
});

test('koordinatör protokolü hazırlar ve imzacılara gönderir', async ({ page }) => {
  await login(page, 'koord.iktisat', '/panel');
  await expect(page.getByText('Protokolü hazırlanacak öğrenciler')).toBeVisible();
  await page.goto(`/koordinator/${IKT}/ogrenciler`);
  await page.getByRole('link', { name: 'Ayşe Demirtaş' }).click();
  await page.waitForURL(/\/kayitlar\//);
  enrollmentUrl = new URL(page.url()).pathname;
  await page.getByRole('button', { name: 'Taslağı kaydet ve denetle' }).click();
  await expect(page.getByText('Protokol taslağı kaydedildi; kurallar sağlanıyor.')).toBeVisible();
  await expect(page.getByText(/228 protokol \+ 14 ortak = 242 AKTS/)).toBeVisible();
  await page.getByRole('button', { name: 'İmzacılara gönder' }).click();
  await expect(page.getByText('İmzalar · 1. tur')).toBeVisible();
  await expect(page.getByText('Onayda', { exact: true }).first()).toBeVisible();
});

test('beş imza: koordinatör (öğrenci ıslak imzası dahil), danışman, iki bölüm başkanı', async ({ page }) => {
  for (const u of ['koord.iktisat', 'danisman.isletme', 'bolum.isletme', 'bolum.iktisat']) await approveAll(page, u);
  await login(page, 'birim.iibf', enrollmentUrl);
  await page.getByRole('button', { name: 'Aslı öğrenci dosyasına kaldırıldı' }).click();
  await expect(page.getByText(/^Aslı dosyada: birim\.iibf/)).toBeVisible();
});

test('dönemlik ders kayıt formu: onaylar, toplu teslim, OBİS listesi', async ({ page }) => {
  acceptDialogs(page);
  await login(page, 'koord.iktisat', enrollmentUrl);
  const section = page.locator('section').filter({ hasText: 'Ders kayıt formu' });
  const boxes = section.getByRole('checkbox');
  for (let i = 0; i < 4; i++) await boxes.nth(i).check();
  await section.getByRole('button', { name: 'Formu kaydet' }).click();
  await expect(page.getByText('Ders kayıt formu kaydedildi.')).toBeVisible();
  await section.getByRole('button', { name: /İmzacılara gönder/ }).click();
  await expect(section.getByText('İmzalar · 1. tur')).toBeVisible();

  for (const u of ['koord.iktisat', 'danisman.isletme', 'bolum.isletme', 'bolum.iktisat']) await approveAll(page, u);

  await login(page, 'koord.iktisat', '/koordinator/teslim');
  await page.getByRole('button', { name: 'Onaylı 1 formu teslim et' }).click();
  await expect(page.getByText('Öğrenci işlerine teslim edildi', { exact: true })).toBeVisible();

  await login(page, 'birim.iibf', '/birim/ders-kayitlari');
  await expect(page.getByRole('link', { name: 'OBİS listesi (CSV)' })).toBeVisible();
  await page.getByRole('button', { name: "Seçilenleri OBİS'e girildi olarak işaretle" }).click();
  await expect(page.getByText("OBİS'e girildi", { exact: true })).toBeVisible();
});

test('ÖİDB: denetim kaydında imzalar görünür; kullanıcı ekranı açılır', async ({ page }) => {
  await login(page, 'oidb.yonetici', '/oidb/denetim?islem=APPROVAL');
  await expect(page.getByText('APPROVAL_APPROVED').first()).toBeVisible();
  await page.goto('/oidb/kullanicilar');
  await expect(page.getByRole('heading', { name: /Kullanıcılar \(/ })).toBeVisible();
});
