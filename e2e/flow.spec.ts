import { expect, test, type Page } from '@playwright/test';
import { acceptDialogs, login } from './helpers';

/**
 * Bilgisayar Mühendisliği ÇAP / yan dal otomasyonu — arayüzden uçtan uca (Keycloak girişi dahil):
 * öğrenci bilgilerini girer ve belge yükler → başvuru → komisyon beyanı doğrular → sıralama, karar, ilan →
 * öğrenci kesin kaydını onaylar → protokol (5 imza) → ders kayıt formu (3 imza) → not girişi →
 * özel şartlı ders muafiyeti → dönem sonu taraması → yönetim.
 */
test.describe.configure({ mode: 'serial' });

const CAP = 'O-2026-GUZ-CAP';
const KOORD = 'koord.bilgisayar';
const AYSE = '253302001';
const MERT = '253302012';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< >>\nendobj\ntrailer\n<< >>\n%%EOF\n', 'latin1');
let enrollmentUrl = '';

async function applyCap(page: Page, user: string) {
  await login(page, user, '/ogrenci/basvuru');
  const card = page.locator('section').filter({ hasText: 'Bilgisayar Mühendisliği Çift Ana Dal' }).first();
  await card.getByRole('checkbox').check();
  await card.getByRole('button', { name: 'Çift Ana Dal başvurusu yap' }).click();
  await page.waitForURL(/\/ogrenci\/basvuru\/[^/]+\?gonderildi=1/);
}

async function signAll(page: Page, user: string) {
  await login(page, user, '/onaylar');
  // Atılan imza listeden düşer; bekleyen kalmayana kadar ilk kartı imzala.
  const buttons = page.getByRole('button', { name: /^(İmzala|Islak imza alındı)$/ });
  await expect(page.getByText(/İmzanız:|Islak imza:|İmzanızı bekleyen form yok/).first()).toBeVisible();
  for (let n = await buttons.count(); n > 0; n--) {
    await buttons.first().click();
    await expect(buttons).toHaveCount(n - 1);
  }
}

test('öğrenci bilgilerini kendisi girer ve belgesini yükler', async ({ page }) => {
  await login(page, MERT, '/panel');
  await expect(page.getByText('Bilgilerinizi girin')).toBeVisible();
  await page.goto('/ogrenci/bilgilerim');
  await expect(page.getByText('Başvurabilmek için önce bilgilerinizi kaydedin.')).toBeVisible();
  await expect(page.getByLabel('Öğrenci numarası')).toHaveValue(MERT);
  await page.getByLabel('Ana dal bölümü').selectOption('P-EEM');
  await page.getByLabel('Kayıt yılı').fill('2025');
  await page.getByLabel('Başlayacağınız yarıyıl').fill('3');
  await page.getByLabel('Ana dal danışmanı').selectOption('danisman.eem');
  // Geçersiz GNO sunucuda reddedilir; girilen değerler formda kalır.
  await page.getByLabel('Genel not ortalaması (GNO)').fill('2,90');
  await page.getByLabel('Sınıftaki başarı sıranız').fill('90');
  await page.getByLabel('Sınıf mevcudu').fill('82');
  await page.getByRole('button', { name: 'Bilgilerimi kaydet' }).click();
  await expect(page.getByText('Sınıf sırası mevcuttan büyük olamaz')).toBeVisible();
  await expect(page.getByLabel('Kayıt yılı')).toHaveValue('2025');
  await page.getByLabel('Sınıftaki başarı sıranız').fill('12');
  await page.getByLabel('Yerleştirme puanı').fill('384,5');
  await page.getByLabel('Başarı sırası', { exact: false }).last().fill('115000');
  await page.getByRole('button', { name: 'Bilgilerimi kaydet' }).click();
  await expect(page.getByText('Bilgileriniz kaydedildi.')).toBeVisible();
  await expect(page.getByText('Sınıfınızda en üst %14,6 içindesiniz.')).toBeVisible();

  await page.getByLabel('Dosya').setInputFiles({ name: 'yks-sonuc-belgesi.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.getByRole('button', { name: 'Yükle' }).click();
  await expect(page.getByRole('link', { name: 'yks-sonuc-belgesi.pdf' })).toBeVisible();
});

test('öğrenci uygunluğunu kural kural görür ve çevrim içi başvurur', async ({ page }) => {
  // Koşulu sağlamayan öğrenci nedenini görür; başvuru düğmesi çıkmaz.
  await login(page, '253302003', '/ogrenci/basvuru');
  const cap = page.locator('section').filter({ hasText: 'Bilgisayar Mühendisliği Çift Ana Dal' }).first();
  await expect(cap.getByText('Uygun değil', { exact: true })).toBeVisible();
  await expect(cap.getByText('GNO 2,74 < 2,75')).toBeVisible();
  await expect(cap.getByRole('button', { name: /başvurusu yap/ })).toHaveCount(0);
  // Aynı öğrenci yan dal için uygundur.
  await expect(page.locator('section').filter({ hasText: 'Bilgisayar Mühendisliği Yan Dal' }).first().getByText('Uygun', { exact: true })).toBeVisible();

  await applyCap(page, MERT);
  await expect(page.getByText('Başvurunuz alındı.')).toBeVisible();
  await expect(page.getByText('Doğrulama bekliyor').first()).toBeVisible();
  for (const s of [AYSE, '253302009', '253302010', '253302011']) await applyCap(page, s);
});

test('komisyon beyanları belgeyle doğrular, başvuruyu kapatır ve sıralamayı kilitler', async ({ page }) => {
  acceptDialogs(page);
  await login(page, KOORD, '/panel');
  await expect(page.getByText('Beyanı doğrulanacak başvurular')).toBeVisible();

  const list = '/koordinator/basvurular?durum=SUBMITTED&dogrulama=PENDING';
  for (let i = 0; i < 5; i++) {
    await page.goto(list);
    await page.locator('tbody tr').first().getByRole('link').click();
    await expect(page.getByRole('heading', { name: 'Öğrencinin beyanı' })).toBeVisible();
    await page.getByRole('button', { name: 'Beyan belgelerle uyuşuyor' }).click();
    await expect(page.getByText('Belgeyle doğrulandı').first()).toBeVisible();
  }
  await page.goto(list);
  await expect(page.getByText('Bu süzgece uyan başvuru yok.')).toBeVisible();

  await page.goto('/koordinator/donem');
  const card = page.locator('section').filter({ hasText: 'Bilgisayar Mühendisliği Çift Ana Dal' }).first();
  await card.getByRole('button', { name: 'Başvuruyu şimdi kapat' }).click();
  await expect(card.getByText('Başvuru kapandı')).toBeVisible();

  await page.goto(`/koordinator/degerlendirme/${CAP}`);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0)).toContainText('Büşra Yalçın');
  await expect(rows.nth(2)).toContainText('Ayşe Demirtaş');
  await expect(rows.nth(3)).toContainText('Yedek');
  await page.getByRole('button', { name: 'Öneriyi kilitle' }).click();
  await expect(page.getByText(/tarihinde kilitlendi/)).toBeVisible();
});

test('kurul kararı girilir ve sonuçlar ilan edilir', async ({ page }) => {
  acceptDialogs(page);
  await login(page, KOORD, `/koordinator/degerlendirme/${CAP}`);
  await page.getByLabel('Karar sayısı').fill('2026/41-7');
  await page.getByRole('button', { name: 'Kararı kaydet' }).click();
  await expect(page.getByText(/Karar 2026\/41-7/)).toBeVisible();
  await page.getByRole('button', { name: 'Sonuçları yayımla' }).click();
  await expect(page.getByText(/tarihinde yayımlandı/)).toBeVisible();
  await page.goto(`/yazdir/sonuc/${CAP}`);
  await expect(page.getByText('253***009')).toBeVisible();
});

test('öğrenci kesin kaydını kendisi onaylar', async ({ page }) => {
  acceptDialogs(page);
  await login(page, AYSE, '/panel');
  await expect(page.getByText('Kesin kaydınızı onaylayın')).toBeVisible();
  await page.goto('/ogrenci/basvuru');
  await page.getByRole('link', { name: 'Kesin kaydı onayla' }).click();
  await page.getByRole('button', { name: 'Kesin kaydımı onaylıyorum' }).click();
  await page.waitForURL(/\/kayitlar\/[^/]+\?kayit=1/);
  await expect(page.getByText('Kesin kaydınız yapıldı.')).toBeVisible();
  enrollmentUrl = new URL(page.url()).pathname;
});

test('protokol gerçek EEM şablonundan üretilir ve beş imzayla tamamlanır', async ({ page }) => {
  acceptDialogs(page);
  await login(page, KOORD, enrollmentUrl);
  await page.getByRole('button', { name: 'Protokolü şablondan üret' }).click();
  await expect(page.getByText('+ 105 AKTS ana dalda alınan ortak dersler = 240')).toBeVisible();
  await expect(page.getByText(/135 protokol \+ 105 ortak = 240 AKTS/)).toBeVisible();
  await page.getByRole('button', { name: 'İmzaya gönder' }).click();
  await expect(page.getByText('İmzalar · 1. tur')).toBeVisible();

  for (const u of [AYSE, 'danisman.eem', 'bolum.eem', 'bolum.bilgisayar']) await signAll(page, u);
  await login(page, AYSE, enrollmentUrl);
  await expect(page.getByText('İmzalar tamam', { exact: true }).first()).toBeVisible();
  await page.goto(enrollmentUrl.replace('/kayitlar/', '/yazdir/protokol/'));
  await expect(page.getByText('ÇİFT ANADAL KABUL ve DERS PROTOKOL FORMU')).toBeVisible();
  await expect(page.getByText(/3302458 kodlu Veri Yapıları/)).toBeVisible();
});

test('öğrenci ders kayıt formunu hazırlar; danışman ve koordinatör imzalar', async ({ page }) => {
  acceptDialogs(page);
  await login(page, AYSE, enrollmentUrl);
  const form = page.locator('section').filter({ hasText: 'Ders kayıt formu' }).first();
  await form.getByRole('checkbox', { name: /Bilgisayar Mühendisliğine Giriş/ }).check();
  await form.getByLabel('5. Yarıyıl Teknik Seçmeli Ders (1)').selectOption('3301562');
  await form.getByRole('button', { name: 'Formu kaydet' }).click();
  await expect(form.getByText('Formda 2 ders, 8 AKTS var.')).toBeVisible();
  await form.getByRole('button', { name: 'İmzaya gönder' }).click();
  await expect(form.getByText('İmzada', { exact: true }).first()).toBeVisible();

  await signAll(page, 'danisman.eem');
  await signAll(page, 'koord.uye');
  await login(page, AYSE, enrollmentUrl);
  await expect(page.locator('section').filter({ hasText: 'Ders kayıt formu' }).first().getByText('İmzalar tamam', { exact: true }).first()).toBeVisible();
});

test('komisyon not girer; öğrenci özel şartlı ders muafiyeti başvurusu yapar', async ({ page }) => {
  acceptDialogs(page);
  await login(page, KOORD, enrollmentUrl);
  await page.getByLabel('Bilgisayar Mühendisliğine Giriş notu').selectOption('BA');
  await page.getByLabel('Tasarım Desenleri notu').selectOption('BB');
  await page.getByRole('button', { name: 'Notları kaydet' }).click();
  await expect(page.getByText('2 dersin notu işlendi.')).toBeVisible();
  await expect(page.getByText('Geçti · BA')).toBeVisible();

  await login(page, AYSE, enrollmentUrl);
  await page.getByLabel('Şart 1: dersi aldığı dönem').fill('2025-2026 Bahar');
  await page.getByLabel('Şart 1: ana daldaki not').selectOption('BB');
  await page.locator('li').filter({ hasText: '3302458' }).getByRole('button', { name: 'Muafiyet başvurusu yap' }).click();
  await expect(page.getByText('Beyan: 2025-2026 Bahar döneminde BB')).toBeVisible();

  await signAll(page, 'danisman.eem');
  await signAll(page, KOORD);
  await login(page, AYSE, enrollmentUrl);
  await expect(page.getByText('Muaf · M')).toBeVisible();
  // 4 + 4 AKTS geçildi, 4 AKTS muaf
  await expect(page.getByText('12/135 (%9)')).toBeVisible();
});

test('dönem sonu taraması bulguları üretir; kayıt silme kararı komisyondadır', async ({ page }) => {
  acceptDialogs(page);
  await login(page, KOORD, '/koordinator/taramalar');
  await expect(page.getByLabel('Dönem')).toHaveValue('T-2025-BAHAR');
  await page.getByRole('button', { name: 'Taramayı başlat' }).click();
  await page.waitForURL(/\/koordinator\/taramalar\/[^/]+$/);
  const hakan = page.locator('section').filter({ hasText: 'Hakan Doğan' });
  await expect(hakan.getByText('Kayıt silme adayı')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('section').filter({ hasText: 'Onur Tekin' }).getByText('Uyarı', { exact: true })).toBeVisible();
  await hakan.getByLabel('Gerekçe (karar sayısı vb.)').fill('Fakülte Yönetim Kurulu 2026/42-3');
  await hakan.getByRole('button', { name: 'Onayla (kaydı sil)' }).click();
  await expect(hakan.getByText(/Onaylandı — koord\.bilgisayar/)).toBeVisible();
  await expect(hakan.getByText('Kaydı silindi')).toBeVisible();
});

test('ana dal imzacısı yalnız kendi bölümünü görür; bölüm başkanı kullanıcıları ve denetim kaydını yönetir', async ({ page }) => {
  await login(page, 'danisman.makine', '/ana-dal');
  await expect(page.getByRole('link', { name: 'Onur Tekin' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ayşe Demirtaş' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Başvurular' })).toHaveCount(0);

  await login(page, 'bolum.bilgisayar', '/yonetim/kullanicilar');
  await expect(page.getByRole('heading', { name: 'Personel (7)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Rol ata' })).toBeVisible();
  await page.goto('/yonetim/denetim?islem=APPROVAL');
  await expect(page.getByText('APPROVAL_APPROVED').first()).toBeVisible();
  await page.goto('/raporlar');
  await expect(page.getByRole('heading', { name: 'Bu dönemin başvuruları' })).toBeVisible();
});
