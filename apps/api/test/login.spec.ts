/**
 * Yerel giriş: şifre doğrulama, imzalı belirteç, tek kullanımlık şifre belirleme bağlantısı.
 * Burada belirteç doğrulayıcı ve kimlik servisi gerçektir; yalnızca e-posta gönderimi sahtedir.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SignJWT } from 'jose';
import request from 'supertest';
import { DEV_PASSWORD } from '@cap/seed-data';
import { AppModule } from '../src/app.module';
import { MailPort } from '../src/integrations/integrations.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup';
import { HEAD, KOORD } from './app';

class FakeMail extends MailPort {
  sent: { to: string; subject: string; text: string }[] = [];
  async send(to: string, subject: string, text: string) {
    this.sent.push({ to, subject, text });
  }
}

const BUSRA = '253302009';

describe('Yerel giriş', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const mail = new FakeMail();
  const http = () => request(app.getHttpServer());
  const login = (username: string, password: string) => http().post('/api/v1/auth/login').send({ username, password });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(MailPort).useValue(mail).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, { WEB_ORIGIN: 'http://localhost:3000' });
    await app.init();
    prisma = app.get(PrismaService);
    // Önceki test dosyalarının sahte belirteçleri hesaplara sahte kimlik bağlamış olabilir.
    await prisma.user.updateMany({ data: { oidcSub: null } });
  });

  afterAll(async () => {
    // Diğer test dosyaları sahte belirteç kullanır (sub-<kullanıcı>); gerçek girişin bağladığı kimliği çöz.
    await prisma.user.updateMany({ data: { oidcSub: null } });
    await app.close();
  });

  it('doğru şifreyle belirteç verir; belirteçle /me çalışır', async () => {
    const r = await login(KOORD, DEV_PASSWORD).expect(200);
    expect(r.body.accessToken).toBeTruthy();
    expect(r.body).not.toHaveProperty('passwordHash');
    const me = await http().get('/api/v1/me').set('authorization', `Bearer ${r.body.accessToken}`).expect(200);
    expect(me.body.username).toBe(KOORD);
    expect(me.body.role).toBe('KOORDINATOR');
  });

  it('yanlış şifre ve olmayan kullanıcı aynı yanıtı alır', async () => {
    const wrong = await login(KOORD, 'yanlis-sifre').expect(401);
    const none = await login('olmayan.kullanici', 'yanlis-sifre').expect(401);
    expect(wrong.body.detail ?? wrong.body.message).toEqual(none.body.detail ?? none.body.message);
  });

  it('başka anahtarla imzalanmış ya da imzasız belirteç reddedilir', async () => {
    const forged = await new SignJWT({ preferred_username: KOORD })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('x')
      .setIssuer('cap-api')
      .setAudience('cap-web')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('baska-bir-anahtar-baska-bir-anahtar-123'));
    await http().get('/api/v1/me').set('authorization', `Bearer ${forged}`).expect(401);
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'x', preferred_username: KOORD })).toString('base64url')}.`;
    await http().get('/api/v1/me').set('authorization', `Bearer ${none}`).expect(401);
  });

  it('pasif hesap giremez', async () => {
    const u = await prisma.user.findUniqueOrThrow({ where: { username: HEAD } });
    await prisma.user.update({ where: { id: u.id }, data: { active: false } });
    try {
      await login(HEAD, DEV_PASSWORD).expect(403);
    } finally {
      await prisma.user.update({ where: { id: u.id }, data: { active: true } });
    }
  });

  it('şifre belirleme bağlantısı tek kullanımlıktır; yeni şifreyle giriş yapılır', async () => {
    await http().post('/api/v1/auth/forgot').send({ username: BUSRA }).expect(200);
    const msg = mail.sent.at(-1)!;
    const token = /anahtar=([\w-]+)/.exec(msg.text)![1];
    // Veritabanında anahtarın kendisi değil, özeti durur.
    const u = await prisma.user.findUniqueOrThrow({ where: { username: BUSRA } });
    expect(u.resetTokenHash).not.toBe(token);

    await http().post('/api/v1/auth/password').send({ token, password: 'kisa' }).expect(400);
    await http().post('/api/v1/auth/password').send({ token, password: 'Yepyeni.Sifre2026' }).expect(200);
    await http().post('/api/v1/auth/password').send({ token, password: 'Baska.Sifre2026' }).expect(400);
    await login(BUSRA, DEV_PASSWORD).expect(401);
    await login(BUSRA, 'Yepyeni.Sifre2026').expect(200);
  });

  it('olmayan kullanıcı için de aynı yanıt; e-posta gitmez', async () => {
    const before = mail.sent.length;
    await http().post('/api/v1/auth/forgot').send({ username: 'olmayan.kullanici' }).expect(200);
    expect(mail.sent.length).toBe(before);
  });
});
