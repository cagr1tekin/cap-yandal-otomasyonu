/**
 * Sızma testleri (kendi uygulamamız, kendi test ortamımız; yalnızca sentetik veri). docs/GUVENLIK.md:
 * kimlik doğrulama, yetki ve kapsam (IDOR), rol yükseltme, toplu atama, enjeksiyon, dosya yükleme,
 * başlıklar, oran sınırı ve silinmezlik.
 */
import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from '../src/prisma/prisma.service';
import { bootstrap, HEAD, KOORD, PDF } from './app';

const BUSRA = '253302009';
const TOLGA = '243303017';
const HAKAN = '243302015';

const pdf = (extra: string) => Buffer.from(`%PDF-1.4\n1 0 obj\n<< ${extra} >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`, 'latin1');

describe('Sızma testleri', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: Awaited<ReturnType<typeof bootstrap>>;
  let tolgaDoc: string;
  let tolgaAttempt: string;
  let tolgaItem: string;

  beforeAll(async () => {
    ctx = await bootstrap();
    ({ app, prisma } = ctx);
    tolgaDoc = (await prisma.document.findFirstOrThrow({ where: { studentNo: TOLGA } })).id;
    tolgaAttempt = (await prisma.courseAttempt.findFirstOrThrow({ where: { studentNo: TOLGA } })).id;
    tolgaItem = (await prisma.planItem.findFirstOrThrow({ where: { studentNo: TOLGA } })).id;
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('kimlik doğrulama', () => {
    it('belirteçsiz, bozuk imzalı ve tanımsız hesap reddedilir', async () => {
      await ctx.http().get('/api/v1/me').expect(401);
      await ctx.http().get('/api/v1/me').set('authorization', 'Basic YWRtaW46YWRtaW4=').expect(401);
      await ctx.as('bozuk').get('/me').expect(401);
      // Kimlik servisinde kendi kendine açılmış (koordinatörün açmadığı) hesap hiçbir şey yapamaz.
      await ctx.as('kendi.acti').get('/me').expect(403);
      await ctx.as('kendi.acti').get('/courses').expect(403);
    });

    it('aynı kullanıcı adıyla farklı kimlik (sub) eski hesabı devralamaz', async () => {
      await ctx.as(BUSRA).get('/me').expect(200);
      await ctx.as(`${BUSRA}|baska-kimlik`).get('/me').expect(401);
    });

    it('pasif hesap reddedilir', async () => {
      await prisma.user.update({ where: { username: HAKAN }, data: { active: false } });
      await ctx.as(HAKAN).get('/me').expect(403);
      await prisma.user.update({ where: { username: HAKAN }, data: { active: true } });
    });
  });

  describe('yetki ve kapsam (IDOR)', () => {
    it('öğrenci başka öğrencinin hiçbir kaydına erişemez; varlık bile sızdırılmaz', async () => {
      const b = ctx.as(BUSRA);
      for (const url of [`/students/${TOLGA}`, `/students/${TOLGA}/documents`, `/students/${TOLGA}/messages`, `/students/${TOLGA}/notes`, `/students/${TOLGA}/history`, `/documents/${tolgaDoc}/file`, '/students/000000000']) {
        await b.get(url).expect(404);
      }
      await b.post(`/students/${TOLGA}/plan`, { courseCode: '3301553' }).expect(404);
      await b.post(`/students/${TOLGA}/messages`, { body: 'merhaba' }).expect(404);
      await b.upload(TOLGA, { kind: 'DIGER' }, PDF).expect(404);
      await b.post(`/attempts/${tolgaAttempt}/cancel`, { reason: 'başkasının kaydı' }).expect(404);
      await b.post(`/plan-items/${tolgaItem}/cancel`, { reason: 'başkasının kaydı' }).expect(404);
    });

    it('kendi numarasıyla başkasının kayıt kimliği kullanılamaz', async () => {
      const b = ctx.as(BUSRA);
      await b.post(`/students/${BUSRA}/attempts`, { planItemId: tolgaItem, termId: 'T-2026-GUZ' }).expect(404);
      await b.post(`/students/${BUSRA}/grade-submissions`, { termId: 'T-2025-BAHAR', transcriptId: tolgaDoc, grades: [{ attemptId: tolgaAttempt, grade: 'AA' }] }).expect(422);
      await b.upload(BUSRA, { kind: 'DIGER', replacesId: tolgaDoc }, PDF).expect(404);
    });

    it('öğrenci koordinatör işlemlerini yapamaz', async () => {
      const b = ctx.as(BUSRA);
      await b.get('/students').expect(403);
      await b.get('/users').expect(403);
      await b.get('/audit').expect(403);
      await b.get('/reviews').expect(403);
      await b.post('/courses', { code: 'X1234', name: 'Sahte Ders', ects: 4, semester: 1, kind: 'ZORUNLU' }).expect(403);
      await b.put('/settings', { uploadMaxMb: 20, uploadTypes: ['application/pdf'], messageMaxLength: 4000 }).expect(403);
      await b.post('/imports', { kind: 'COURSES', rows: [{ code: 'X1' }] }).expect(403);
      await b.post(`/students/${BUSRA}/gano`, { termId: 'T-2026-GUZ', gano: 4, source: 'TRANSKRIPT' }).expect(403);
      await b.post(`/students/${BUSRA}/decisions`, { type: 'MEZUNIYET', reason: 'kendime diploma' }).expect(403);
      const pending = await prisma.courseAttempt.findFirstOrThrow({ where: { studentNo: BUSRA, status: 'PENDING' } });
      await b.post(`/reviews/attempt/${pending.id}`, { decision: 'APPROVED' }).expect(403);
      await b.patch(`/attempts/${pending.id}`, { grade: 'AA', reason: 'kendi notumu yükseltiyorum' }).expect(403);
    });

    it('bölüm başkanı yalnızca izler: veri değiştiren hiçbir istek geçmez', async () => {
      const h = ctx.as(HEAD);
      for (const url of ['/students', '/reviews', '/users', '/audit', '/checks', `/students/${TOLGA}`, `/students/${TOLGA}/notes`, `/documents/${tolgaDoc}/file`]) await h.get(url).expect(200);
      await h.post('/students', { studentNo: '263300001' }).expect(403);
      await h.patch(`/students/${TOLGA}`, { fullName: 'Değiştirildi', reason: 'deneme amaçlı' }).expect(403);
      await h.put('/settings', {}).expect(403);
      await h.post(`/students/${TOLGA}/notes`, { body: 'not' }).expect(403);
      await h.post(`/reviews/document/${tolgaDoc}`, { decision: 'APPROVED' }).expect(403);
      await h.post('/checks/run-all').expect(403);
      await h.upload(TOLGA, { kind: 'DIGER' }, PDF).expect(403);
      // Bildirimini okundu işaretleyebilir (veri değiştirmez).
      await h.post('/notifications/read-all').expect(201);
    });
  });

  describe('toplu atama ve enjeksiyon', () => {
    it('istekteki fazladan alanlar yok sayılır (durum, kaynak, onay)', async () => {
      await ctx.as(BUSRA).put(`/students/${BUSRA}/contact`, { phone: '0555 000 00 00', status: 'GRADUATED', track: 'YANDAL' }).expect(200);
      expect(await prisma.student.findUnique({ where: { studentNo: BUSRA } })).toMatchObject({ status: 'ACTIVE', track: 'CAP', phone: '0555 000 00 00' });
      const r = await ctx.as(BUSRA).post(`/students/${BUSRA}/plan`, { courseCode: '3301158', status: 'APPROVED', source: 'COORDINATOR' }).expect(201);
      expect(r.body).toMatchObject({ status: 'PENDING', source: 'STUDENT' });
    });

    it('SQL ve yol enjeksiyonu: parametreli sorgu, biçim denetimi', async () => {
      const all = (await ctx.as(KOORD).get('/students').expect(200)).body.length;
      const inj = await ctx.as(KOORD).get(`/students?q=${encodeURIComponent("' OR '1'='1")}`).expect(200);
      expect(inj.body.length).toBeLessThan(all);
      await ctx.as(KOORD).get(`/courses?q=${encodeURIComponent('%; DROP TABLE "Course"; --')}`).expect(200);
      expect(await prisma.course.count()).toBeGreaterThan(100);
      await ctx.as(BUSRA).get(`/students/${encodeURIComponent('../253302009')}`).expect(404);
      await ctx.as(BUSRA).post(`/students/${BUSRA}/plan`, { courseCode: "3301553'; --" }).expect(400);
      await ctx.as(BUSRA).get('/documents/..%2F..%2Fetc%2Fpasswd/file').expect(404);
    });

    it('mesajdaki betik verisi düz metin olarak saklanır ve JSON olarak döner', async () => {
      await ctx.as(BUSRA).post(`/students/${BUSRA}/messages`, { body: '<script>alert(1)</script><img src=x onerror=alert(2)>' }).expect(201);
      const res = await ctx.as(KOORD).get(`/students/${BUSRA}/messages`).expect(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.at(-1).body).toBe('<script>alert(1)</script><img src=x onerror=alert(2)>');
    });
  });

  describe('dosya yükleme', () => {
    const up = (buf: Buffer, name = 'belge.pdf') => ctx.as(BUSRA).upload(BUSRA, { kind: 'DIGER' }, buf, name);

    it('içerik türü uzantıdan değil içerikten belirlenir', async () => {
      await up(Buffer.from('MZ\x90\x00 çalıştırılabilir', 'latin1'), 'fatura.pdf').expect(400);
      await up(Buffer.from('<?php system($_GET["c"]); ?>'), 'kabuk.pdf').expect(400);
      await up(Buffer.from('<html><script>alert(1)</script></html>'), 'sayfa.png').expect(400);
      await up(Buffer.alloc(0), 'bos.pdf').expect(400);
    });

    it('bozuk ve zararlı içerik reddedilir', async () => {
      await up(Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\n'), 'yarim.pdf').expect(400);
      await up(pdf('/OpenAction << /S /JavaScript /JS (app.alert(1)) >>')).expect(400);
      await up(pdf('/OpenAction << /S /Launch /F (cmd.exe) >>')).expect(400);
      await up(pdf('/Names << /EmbeddedFiles << >> >> /EmbeddedFile')).expect(400);
      await up(pdf('/Encrypt 5 0 R')).expect(400);
      await up(pdf('/X (X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*)')).expect(400);
      await up(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), 'kirik.jpg').expect(400);
    });

    it('dosya adı temizlenir; dosya yolu sunucuda rastgele üretilir', async () => {
      const r = await up(PDF, '../../../etc/passwd.pdf').expect(201);
      expect(r.body.fileName).toBe('passwd.pdf');
      const w = await up(PDF, '..\\..\\windows\\win.ini<>.exe').expect(201);
      expect(w.body.fileName).toBe('win.ini.pdf');
      expect(r.body.storageKey).toMatch(new RegExp(`^${BUSRA}/[0-9a-f-]{36}\\.pdf$`));
    });

    it('boyut sınırı ayarlardan uygulanır', async () => {
      const before = (await ctx.as(KOORD).get('/settings').expect(200)).body;
      await ctx.as(KOORD).put('/settings', { ...before, uploadMaxMb: 1 }).expect(200);
      const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(1_200_000, 0x20), Buffer.from('\n%%EOF\n')]);
      await up(big).expect(400);
      await ctx.as(KOORD).put('/settings', { ...before, uploadTypes: ['application/pdf'] }).expect(200);
      await up(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('....IEND....')]), 'resim.png').expect(400);
      await ctx.as(KOORD).put('/settings', before).expect(200);
    });

    it('belge yanıtı türünü zorlar ve tarayıcıda betik çalıştırmaz', async () => {
      const r = await ctx.as(BUSRA).get(`/documents/${(await prisma.document.findFirstOrThrow({ where: { studentNo: BUSRA } })).id}/file`).expect(200);
      expect(r.headers['content-type']).toBe('application/pdf');
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      expect(r.headers['content-security-policy']).toContain("default-src 'none'");
      expect(r.headers['cache-control']).toContain('no-store');
    });

    it('yükleme oran sınırı (dakikada 20)', async () => {
      const codes: number[] = [];
      for (let i = 0; i < 22; i++) codes.push((await up(Buffer.from('x'))).status);
      expect(codes).toContain(429);
    });
  });

  describe('silinmezlik ve başlıklar', () => {
    it('silme uç noktası yoktur; veritabanı silmeyi reddeder', async () => {
      await ctx.as(KOORD).del(`/students/${TOLGA}`).expect(404);
      await ctx.as(KOORD).del(`/documents/${tolgaDoc}`).expect(404);
      for (const table of ['Student', 'Document', 'Message', 'CourseAttempt', 'PlanItem', 'GanoRecord', 'RuleCheck', 'User']) {
        await expect(prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE false OR true`)).rejects.toThrow(/silinemez/);
      }
    });

    it('güvenlik başlıkları (helmet) üretim uygulamasında açıktır', async () => {
      const r = await ctx.http().get('/api/v1/health');
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      expect(r.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(r.headers['x-powered-by']).toBeUndefined();
    });
  });
});
