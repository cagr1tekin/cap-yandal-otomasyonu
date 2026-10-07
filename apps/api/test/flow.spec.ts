/**
 * Uçtan uca API akışı (gerçek PostgreSQL test veritabanı, sahte OBİS/ÖSYM/belirteç):
 * uygunluk → başvuru → pencere kapanışı → sıralama → kilit → karar → yayın → kesin kayıt
 * → yedekten çağırma → dönem sonu taraması → bulgu onayı → kayıt silme.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TokenVerifier } from '../src/auth/auth';
import { ProblemFilter } from '../src/common/http';
import { ObisPort, OsymPort } from '../src/integrations/obis.port';
import { MonitoringService } from '../src/monitoring/monitoring';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakeObis, FakeOsym, FakeTokenVerifier } from './fakes';

const IKT = 'O-2026-GUZ-CAP-IIBF-IKT';

describe('ÇAP başvuru ve takip akışı', () => {
  let app: INestApplication;
  let obis: FakeObis;
  let prisma: PrismaService;

  const as = (user: string) => ({
    get: (url: string) => request(app.getHttpServer()).get(`/api/v1${url}`).set('authorization', `Bearer ${user}`),
    post: (url: string, body?: object) =>
      request(app.getHttpServer()).post(`/api/v1${url}`).set('authorization', `Bearer ${user}`).send(body ?? {}),
    patch: (url: string, body: object) =>
      request(app.getHttpServer()).patch(`/api/v1${url}`).set('authorization', `Bearer ${user}`).send(body),
    put: (url: string, body: object) =>
      request(app.getHttpServer()).put(`/api/v1${url}`).set('authorization', `Bearer ${user}`).send(body),
  });

  beforeAll(async () => {
    obis = new FakeObis();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TokenVerifier)
      .useValue(new FakeTokenVerifier())
      .overrideProvider(ObisPort)
      .useValue(obis)
      .overrideProvider(OsymPort)
      .useValue(new FakeOsym())
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('belirteçsiz istek 401, öğrenci personel ucuna 403', async () => {
    await request(app.getHttpServer()).get('/api/v1/me').expect(401);
    await as('230201001').get('/offerings').expect(403);
  });

  it('uygunluk: kendi programı ve kaynak bölüm kısıtı gerekçesiyle', async () => {
    const res = await as('230201001').get('/me/eligibility?type=CAP').expect(200);
    const by = (name: string) => res.body.items.find((i: { offering: { programName: string } }) => i.offering.programName === name);
    expect(by('İktisat').verdict).toBe('ELIGIBLE');
    expect(by('İşletme').results.find((r: { code: string }) => r.code === 'KR-ÇAP-00').status).toBe('FAIL');
    expect(by('Bilgisayar Mühendisliği').results.find((r: { code: string }) => r.code === 'KR-ÇAP-08').status).toBe('FAIL');
  });

  it('başvurular: sınır GNO, YKS yolu, mükerrer başvuru', async () => {
    for (const s of ['230201001', '230201002', '230201030', '230201031', '230201032', '230201033']) {
      await as(s).post('/applications', { offeringId: IKT }).expect(201);
    }
    const low = await as('230201003').post('/applications', { offeringId: IKT }).expect(422);
    expect(low.body.results[0].code).toBe('KR-ÇAP-02');

    const noDoc = await as('230301004').post('/applications', { offeringId: IKT }).expect(422);
    expect(noDoc.body.needsOsym).toBe(true);
    await as('230301004').post('/applications', { offeringId: IKT, osymDocNo: 'YKS2025-0001234', osymVerificationCode: 'YANLIS' }).expect(422);
    const ok = await as('230301004')
      .post('/applications', { offeringId: IKT, osymDocNo: 'YKS2025-0001234', osymVerificationCode: 'AB12CD' })
      .expect(201);
    expect(ok.body.path).toBe('ENTRY_SCORE');
    await as('230201001').post('/applications', { offeringId: IKT }).expect(409);
  });

  it('pencere açıkken kilit reddedilir; yanlış koordinatör 403', async () => {
    await as('koord.iktisat').post(`/offerings/${IKT}/ranking/lock`).expect(409);
    await as('koord.bilgisayar').get(`/offerings/${IKT}/applications`).expect(403);
  });

  it('sıralama, gerekçeli değişiklik, kontenjan denetimi, kilit', async () => {
    await as('birim.fen').post('/units/U-IIBF/windows/close-now', { termId: 'T-2026-GUZ', type: 'CAP' }).expect(403);
    await as('birim.iibf').post('/units/U-IIBF/windows/close-now', { termId: 'T-2026-GUZ', type: 'CAP' }).expect(201);

    const list = await as('koord.iktisat').get(`/offerings/${IKT}/applications`).expect(200);
    const rows = list.body.rows as { studentNo: string; ranking: { rank: number; proposal: string }; id: string; status: string }[];
    expect(rows.map((r) => r.studentNo).slice(0, 4)).toEqual(['230201030', '230201031', '230201032', '230201001']);
    expect(rows.filter((r) => r.ranking.proposal === 'ASIL')).toHaveLength(4);
    expect(rows.every((r) => r.status === 'UNDER_REVIEW')).toBe(true);

    const fifth = rows[4];
    await as('koord.iktisat').patch(`/rankings/${fifth.id}`, { proposal: 'ASIL', reason: 'x' }).expect(400);
    await as('koord.iktisat').patch(`/rankings/${fifth.id}`, { proposal: 'ASIL', reason: 'Bölüm kurulu önerisi' }).expect(200);
    await as('koord.iktisat').post(`/offerings/${IKT}/ranking/lock`).expect(409);
    await as('koord.iktisat').patch(`/rankings/${fifth.id}`, { proposal: 'YEDEK', reason: 'Kontenjan nedeniyle geri alındı' }).expect(200);
    await as('koord.iktisat').post(`/offerings/${IKT}/ranking/lock`).expect(201);

    const audit = await prisma.auditLog.count({ where: { action: 'RANKING_OVERRIDE', entityId: fifth.id } });
    expect(audit).toBe(2);
  });

  it('karar ve yayın: sonuç yayından önce öğrenciye gösterilmez', async () => {
    await as('koord.iktisat').post(`/offerings/${IKT}/decision`, { decisionDate: '2026-10-07', decisionNo: '2026/45-3' }).expect(403);
    await as('birim.iibf').post(`/offerings/${IKT}/publish`).expect(409);
    await as('birim.iibf').post(`/offerings/${IKT}/decision`, { decisionDate: '2026-10-07', decisionNo: '2026/45-3' }).expect(201);

    const before = await as('230201001').get('/me/applications').expect(200);
    expect(before.body[0].status).toBe('PROPOSED');
    expect(before.body[0].result).toBeNull();

    await as('birim.iibf').post(`/offerings/${IKT}/publish`).expect(201);
    const after = await as('230201001').get('/me/applications').expect(200);
    expect(after.body[0].status).toBe('ACCEPTED');
    expect(after.body[0].result.decisionNo).toBe('2026/45-3');

    const notes = await as('230201001').get('/notifications').expect(200);
    expect(notes.body.items.map((n: { title: string }) => n.title)).toContain('Başvuru sonucunuz ilan edildi');
  });

  it('kesin kayıt eşitleme ve yedekten çağırma', async () => {
    for (const s of ['230201030', '230201031', '230201001']) obis.registrations.add(`${s}:P-IIBF-IKT`);
    const sync = await as('birim.iibf').post(`/offerings/${IKT}/sync-registrations`).expect(201);
    expect(sync.body.enrolled.sort()).toEqual(['230201001', '230201030', '230201031']);
    expect(sync.body.waiting).toEqual(['230201032']);

    const close = await as('birim.iibf').post(`/offerings/${IKT}/close-registration`).expect(201);
    expect(close.body.dropped).toBe(1);
    expect(close.body.promoted).toEqual(['230201033']);

    const csv = await as('birim.iibf').get(`/offerings/${IKT}/export?format=csv`).expect(200);
    expect(csv.text).toContain('Ayşe Demirtaş');
  });

  it('dönem sonu taraması ve birim kararıyla kayıt silme', async () => {
    const scan = await as('oidb.yonetici').post('/scans', { termId: 'T-2026-GUZ' }).expect(201);
    await app.get(MonitoringService).run(scan.body.id);

    const result = await as('oidb.yonetici').get(`/scans/${scan.body.id}`).expect(200);
    const codes = result.body.findings.map((f: { studentNo: string; ruleCode: string; status: string }) => `${f.studentNo}:${f.ruleCode}:${f.status}`);
    expect(codes).toEqual(
      expect.arrayContaining([
        '220301008:KR-YD-06:FAIL',
        '220201009:KR-ÇAP-11:FAIL',
        '220601010:KR-ÇAP-10:FAIL',
        '220201023:KR-ÇAP-12:WARN',
      ]),
    );

    // Birim personeli tüm birimleri kapsayan taramada yalnızca kendi biriminin bulgularını görür.
    const scoped = await as('birim.iletisim').get(`/scans/${scan.body.id}`).expect(200);
    expect(scoped.body.findings.map((f: { studentNo: string }) => f.studentNo)).toEqual(['220601010']);

    const finding = result.body.findings.find((f: { studentNo: string }) => f.studentNo === '220301008');
    await as('birim.fen').patch(`/scan-findings/${finding.id}`, { decision: 'CONFIRMED', reason: 'Yetkisiz deneme' }).expect(403);
    await as('birim.iibf').patch(`/scan-findings/${finding.id}`, { decision: 'CONFIRMED', reason: 'Yönetim kurulu 2026/46' }).expect(200);
    await as('birim.iibf').patch(`/scan-findings/${finding.id}`, { decision: 'DISMISSED', reason: 'Tekrar deneme' }).expect(409);

    const enr = await as('220301008').get('/me/enrollments').expect(200);
    expect(enr.body.items[0].status).toBe('REMOVED');

    const frozen = await prisma.enrollment.findFirst({ where: { studentNo: '220201023' } });
    expect(frozen?.status).toBe('FROZEN');
  });

  it('yan dal planı sınırı ve ÇAP\'tan ayrılınca yan dal sertifikası hakkı', async () => {
    const e = await as('220401011').get('/me/enrollments').expect(200);
    const res = await as('220401011').post(`/enrollments/${e.body.items[0].id}/withdrawal`, { reason: 'Ana dala odaklanacağım' }).expect(201);
    expect(res.body.outcome.eligibleForCertificate).toBe(true);
    expect(res.body.outcome.passedPoolEcts).toBe(42);
  });

  it('denetim kaydı değiştirilemez', async () => {
    await expect(prisma.$executeRawUnsafe('DELETE FROM "AuditLog"')).rejects.toThrow(/değiştirilemez/);
  });
});
