# Yayınlama (ücretsiz katmanlar)

| Parça | Nerede | Not |
|---|---|---|
| Web (Next.js) | Vercel, Hobby | Kök dizin `apps/web` |
| API (NestJS) | Render, free web service | `render.yaml` (Blueprint). 15 dk boşta kalınca uyur, ilk istek ~1 dk |
| Redis (e-posta kuyruğu) | Render Key Value, free | Bellekte; yeniden başlayınca kuyruk boşalır |
| PostgreSQL | Neon, free (Frankfurt) | 0,5 GB; 5 dk boşta kalınca uyur, ilk istekte kendisi uyanır |
| Belgeler | PostgreSQL (`DocumentFile`) | Render free'de kalıcı disk yok: `STORAGE_DRIVER=db` |
| E-posta | Brevo SMTP | Gönderen adresi Brevo'da doğrulanmış olmalı |

Giriş sistemin kendisindedir (Keycloak yok): şifreler scrypt özetiyle `User.passwordHash`'te, oturum API'nin `AUTH_SECRET` ile imzaladığı 8 saatlik belirteçtir. Şifre belirleme bağlantısı tek kullanımlık ve 72 saat geçerlidir; veritabanında yalnızca özeti durur.

## Ortam değişkenleri

**Render (cap-api):** `DATABASE_URL` (Neon, pooler'sız adres, `?sslmode=require`), `WEB_ORIGIN` (Vercel adresi), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. `AUTH_SECRET` Render'da üretilir; geri kalanı `render.yaml`'da.

**Vercel (apps/web):** `NEXTAUTH_URL` (Vercel adresi), `NEXTAUTH_SECRET` (uzun rastgele), `API_URL` (`https://<render-adı>.onrender.com/api/v1`).

## Veritabanı

Göçler API açılırken uygulanır (`prisma migrate deploy`). Deneme verisi bir kez, yerelden yüklenir; tabloları boşaltıp yeniden doldurur:

```bash
cd apps/api
DATABASE_URL='<neon>' STORAGE_DRIVER=db SEED_PASSWORD='<güçlü şifre>' npx tsx prisma/seed.ts
```

Vercel sunucu fonksiyonları 4,5 MB'tan büyük istek almaz; bu yüzden canlıda `uploadMaxMb` ayarı 4'tür (Ayarlar ekranından da değişir).
