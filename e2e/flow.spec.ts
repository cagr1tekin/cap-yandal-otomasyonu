import { expect, test } from '@playwright/test';
import { acceptDialogs, actionLinkFor, login, PDF } from './helpers';

/**
 * Koordinatörün çerçeve e-postasındaki akış, arayüzden uçtan uca (gerçek Keycloak ve Mailpit dahil):
 * öğrenciyi ekle → öğrenci şifresini e-postadaki bağlantıyla belirler → formunu yükler → koordinatör onaylar →
 * ders listesi → dönem dersi → dönem sonu not + not belgesi → onay → mesajlaşma → kural uyarısı → karar.
 */
test.describe.configure({ mode: 'serial' });

const KOORD = 'koord.bilgisayar';
const HEAD = 'bolum.bilgisayar';
// Her koşuda yeni numara: Keycloak hesabı koşular arasında kalır.
const NO = `26${String(Date.now()).slice(-7)}`;
const EMAIL = `e2e.${NO}@ogrenci.selcuk.test`;
const PASSWORD = 'Yeni.Sifre2026';
const card = `/ogrenciler/${NO}`;

test('koordinatör kabul edilen öğrenciyi ekler; öğrenci e-postadaki bağlantıyla şifresini belirler', async ({ page }) => {
  await login(page, KOORD, '/ogrenciler');
  await page.getByText('+ Kabul edilen öğrenciyi ekle').click();
  await page.getByLabel('Öğrenci numarası').fill(NO);
  await page.getByLabel('Ad soyad').fill('Deniz Uçar');
  await page.getByLabel('Okul e-postası').fill(EMAIL);
  await page.getByLabel('Kayıt türü (ÇAP / YDP)').selectOption('CAP');
  await page.getByLabel('Ana dal bölümü (isteğe bağlı)').selectOption('P-EEM');
  await page.getByRole('button', { name: 'Öğrenciyi ekle' }).click();
  await page.waitForURL(new RegExp(`${card}\\?eklendi=1`));
  await expect(page.getByText('Öğrenci eklendi.')).toBeVisible();

  // Kendi kendine kayıt yok: şifreyi öğrenci, okul e-postasına gelen tek kullanımlık bağlantıyla belirler.
  await page.context().clearCookies();
  await page.goto(await actionLinkFor(EMAIL));
  const proceed = page.getByRole('link', { name: /buraya tıklayın|Click here/i });
  if (await proceed.isVisible().catch(() => false)) await proceed.click();
  await page.locator('#password-new').fill(PASSWORD);
  await page.locator('#password-confirm').fill(PASSWORD);
  await page.locator('input[type=submit], button[type=submit]').first().click();

  await login(page, NO, '/panel', PASSWORD);
  await expect(page.getByText('İmzalı protokolünüzü yükleyin')).toBeVisible();
  // Öğrenci başkasının kartını göremez.
  const other = await page.goto('/ogrenciler/243302013');
  expect(other?.status()).toBe(404);
});

test('öğrenci imzalı protokolünü yükler ve alacağı dersi katalogdan ekler', async ({ page }) => {
  await login(page, NO, `${card}?sekme=belgeler`, PASSWORD);
  await page.getByLabel('Belge türü').selectOption('PROTOKOL');
  await page.getByLabel('Dosya').setInputFiles({ name: 'protokol-imzali.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.getByRole('button', { name: 'Yükle' }).click();
  await expect(page.getByText('Belge yüklendi.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'protokol-imzali.pdf' })).toBeVisible();
  // Zararlı içerik reddedilir.
  await page.getByLabel('Dosya').setInputFiles({ name: 'fatura.pdf', mimeType: 'application/pdf', buffer: Buffer.from('MZ çalıştırılabilir') });
  await page.getByRole('button', { name: 'Yükle' }).click();
  await expect(page.getByText(/Bu dosya türü kabul edilmiyor/)).toBeVisible();

  await page.goto(`${card}?sekme=dersler`);
  await page.getByLabel('Ders (kod ya da ad yazıp seçin)').fill('3301158');
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.getByText('Ders listeye eklendi.')).toBeVisible();
  await expect(page.locator('tr').filter({ hasText: 'Lineer Cebir' }).getByText('Onay bekliyor')).toBeVisible();
  // Serbest metinle ders uydurulamaz.
  await page.getByLabel('Ders (kod ya da ad yazıp seçin)').fill('Benim dersim');
  await page.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(page.getByText('Ders kodu 3–12 harf/rakam olmalı')).toBeVisible();
});

test('koordinatör onay kuyruğundan onaylar ve listeyi protokol şablonundan tamamlar', async ({ page }) => {
  await login(page, KOORD, '/onaylar');
  const doc = page.locator('tr').filter({ hasText: 'protokol-imzali.pdf' });
  await doc.getByRole('button', { name: 'Onayla' }).click();
  await expect(doc).toHaveCount(0);
  const item = page.locator('li').filter({ hasText: 'Deniz Uçar' }).filter({ hasText: '3301158' });
  await item.getByRole('button', { name: 'Onayla' }).click();
  await expect(page.locator('li').filter({ hasText: 'Deniz Uçar' }).filter({ hasText: '3301158' })).toHaveCount(0);

  await page.goto(`${card}?sekme=dersler`);
  await page.getByRole('button', { name: 'Şablondaki eksik dersleri ekle' }).click();
  await expect(page.getByText(/satır listeye eklendi/)).toBeVisible();
  await page.goto(card);
  await expect(page.getByText(/141 protokol \+ 105 ortak = 246 AKTS/)).toBeVisible();
});

test('öğrenci bu dönem aldığı dersi girer; koordinatör onaylar', async ({ page }) => {
  await login(page, NO, `${card}?sekme=dersler`, PASSWORD);
  await page.getByRole('combobox', { name: 'Ders', exact: true }).selectOption({ label: '3301156 Bilgisayar Mühendisliğine Giriş (4 AKTS)' });
  await page.getByRole('button', { name: 'Dönem dersini gir' }).click();
  await expect(page.getByText('Dönem dersi girildi.')).toBeVisible();

  await login(page, KOORD, `${card}?sekme=dersler`);
  const row = page.locator('tr').filter({ hasText: 'Bilgisayar Mühendisliğine Giriş' });
  await row.getByRole('button', { name: 'Onayla' }).click();
  await expect(row.getByText('Alındı', { exact: true })).toBeVisible();
});

test('dönem sonu: not belgesi olmadan not gönderilemez; belge yüklenince gönderilir ve onaylanır', async ({ page }) => {
  await login(page, NO, `${card}?sekme=notlar`, PASSWORD);
  await expect(page.getByText('Bu dönemin ÇAP / YDP not belgesi yüklenmedi.')).toBeVisible();
  await page.goto(`${card}?sekme=belgeler`);
  await page.getByLabel('Belge türü').selectOption('CAP_TRANSKRIPT');
  await page.getByLabel('Dönem').selectOption('T-2026-GUZ');
  await page.getByLabel('Dosya').setInputFiles({ name: 'not-belgesi.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.getByRole('button', { name: 'Yükle' }).click();
  await expect(page.getByText('Belge yüklendi.')).toBeVisible();

  await page.goto(`${card}?sekme=notlar`);
  await page.getByLabel('Bilgisayar Mühendisliğine Giriş notu').selectOption('BA');
  await page.getByRole('button', { name: 'Notları onaya gönder' }).click();
  await expect(page.getByText('Onay bekliyor').first()).toBeVisible();

  await login(page, KOORD, '/onaylar');
  const sub = page.getByRole('link', { name: 'not-belgesi.pdf' }).first().locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]');
  await sub.getByRole('button', { name: 'Onayla' }).click();
  await expect(page.getByText('Bekleyen not gönderimi yok.')).toBeVisible();
  await page.goto(`${card}?sekme=dersler`);
  await expect(page.locator('tr').filter({ hasText: 'Bilgisayar Mühendisliğine Giriş' }).getByText('Geçti', { exact: true })).toBeVisible();
});

test('mesajlaşma ve öğrencinin göremediği koordinatör notu', async ({ page }) => {
  await login(page, KOORD, `${card}?sekme=mesajlar`);
  await page.getByLabel('Mesaj').fill('Merhaba, ders kayıt formunuzu da yükler misiniz?');
  await page.getByRole('button', { name: 'Gönder' }).click();
  await expect(page.getByText('Merhaba, ders kayıt formunuzu da yükler misiniz?')).toBeVisible();
  await page.goto(`${card}?sekme=gizli`);
  await page.getByLabel('Yeni not').fill('Öğrenci hızlı ilerliyor; gözlem notu.');
  await page.getByRole('button', { name: 'Not ekle' }).click();
  await expect(page.getByText('Not eklendi (öğrenci görmez).')).toBeVisible();

  await login(page, NO, `${card}?sekme=mesajlar`, PASSWORD);
  await expect(page.getByText('Merhaba, ders kayıt formunuzu da yükler misiniz?')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Koordinatör notları' })).toHaveCount(0);
  await page.getByLabel('Mesaj').fill('Tamam hocam, bu hafta yüklerim.');
  await page.getByRole('button', { name: 'Gönder' }).click();
  await expect(page.getByText('Tamam hocam, bu hafta yüklerim.')).toBeVisible();
  await page.goto(`${card}?sekme=gizli`);
  await expect(page.getByText('Öğrenci hızlı ilerliyor')).toHaveCount(0);
});

test('GANO yalnızca koordinatörce kaynağıyla girilir; uyarı karttadır, karar koordinatördedir', async ({ page }) => {
  acceptDialogs(page);
  await login(page, KOORD, '/ogrenciler/243302013');
  await page.getByLabel("GANO (4'lük)").fill('2,60');
  await page.getByRole('combobox', { name: 'Kaynak', exact: true }).selectOption('TRANSKRIPT');
  await page.getByLabel('Kaynak notu').fill('2026-27 güz transkripti');
  await page.getByRole('button', { name: 'GANO kaydet' }).click();
  await expect(page.getByText('GANO kaydedildi; kurallar yeniden kontrol edildi.')).toBeVisible();
  await expect(page.getByText(/Ana dal GNO düşüşü: Ana dal GNO 2,60/).first()).toBeVisible();

  await page.goto('/ogrenciler/233302020');
  await expect(page.getByText('Yan dal sertifikası koşulları sağlanıyor.')).toBeVisible();
  await page.getByLabel('Dayanak (karar sayısı)').fill('FYK 2026/50-4');
  await page.getByLabel('Gerekçe', { exact: true }).fill('Yan dal listesini 2,00 üzeri ortalamayla tamamladı');
  await page.getByRole('button', { name: 'Kararı kaydet' }).click();
  await expect(page.getByText('Karar kaydedildi.')).toBeVisible();
  await expect(page.getByText('Sertifika aldı').first()).toBeVisible();
});

test('bölüm başkanı yalnızca izler; işlem kaydını görür', async ({ page }) => {
  await login(page, HEAD, `/ogrenciler/243302013?sekme=dersler`);
  await expect(page.getByText('İzleme görünümü: kayıtları görebilirsiniz, değiştiremezsiniz.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ekle', exact: true })).toHaveCount(0);
  await expect(page.getByText('Düzelt')).toHaveCount(0);
  await page.goto('/denetim?islem=GANO');
  await expect(page.getByText('GANO_ADD').first()).toBeVisible();
  await page.goto('/ogrenciler/243302013?sekme=gecmis');
  await expect(page.getByText('GANO_ADD').first()).toBeVisible();
});

test('içeri aktarma önce dener, sonra aynı yoldan yazar', async ({ page }) => {
  await login(page, KOORD, '/iceri-aktar');
  await page.getByLabel('Veri türü').selectOption('ATTEMPTS');
  await page.getByLabel('ya da CSV metni (ilk satır başlık)').fill('studentNo;courseCode;termId;grade\n243302016;3301156;T-2025-GUZ;CB\n999999999;3301156;T-2025-GUZ;BB');
  await page.getByRole('button', { name: 'Dene (yazmaz)' }).click();
  await expect(page.getByText('Deneme: hiçbir şey yazılmadı. Sonucu inceleyip aktarın.')).toBeVisible();
  await expect(page.getByText('HATA', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Aktar' }).click();
  await expect(page.getByText(/Aktarım tamamlandı: 1 satır işlendi, 1 hata/)).toBeVisible();
});
