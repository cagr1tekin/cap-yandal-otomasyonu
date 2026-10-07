/**
 * Rol bazlı personel paneli — uçtan uca API akışı (gerçek PostgreSQL test veritabanı; sahte OBİS/ÖSYM/belirteç).
 * docs/KARARLAR.md: başvuru girişi (K-1), kesin kayıt (K-8), protokol (K-9), ders kaydı (K-10), GNO kuralı (K-2).
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { REGISTRATION_DOCUMENTS } from '@cap/contracts';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TokenVerifier } from '../src/auth/auth';
import { ProblemFilter } from '../src/common/http';
import { ObisPort, OsymPort } from '../src/integrations/obis.port';
import { MonitoringService } from '../src/monitoring/monitoring';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakeObis, FakeOsym, FakeTokenVerifier } from './fakes';

const IKT = 'O-2026-GUZ-CAP-IIBF-IKT';
const TERM = 'T-2026-GUZ';
const RANK_DOCS = ['DILEKCE', 'TRANSKRIPT', 'OGRENCI_BELGESI', 'BASARI_BELGESI'];
const ALL_REG_DOCS = REGISTRATION_DOCUMENTS.map((d) => d.key);

describe('Personel paneli akışı', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ayseEnrollment: string;

  const as = (user: string) => ({
    get: (url: string) => request(app.getHttpServer()).get(`/api/v1${url}`).set('authorization', `Bearer ${user}`),
    post: (url: string, body?: object) => request(app.getHttpServer()).post(`/api/v1${url}`).set('authorization', `Bearer ${user}`).send(body ?? {}),
    put: (url: string, body: object) => request(app.getHttpServer()).put(`/api/v1${url}`).set('authorization', `Bearer ${user}`).send(body),
    patch: (url: string, body: object) => request(app.getHttpServer()).patch(`/api/v1${url}`).set('authorization', `Bearer ${user}`).send(body),
    del: (url: string) => request(app.getHttpServer()).delete(`/api/v1${url}`).set('authorization', `Bearer ${user}`),
  });
  const intake = (studentNo: string, extra: object = {}) => ({
    studentNo,
    offeringId: IKT,
    documentNo: `E-${studentNo}`,
    documentDate: '2026-10-07',
    documents: RANK_DOCS,
    ...extra,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TokenVerifier)
      .useValue(new FakeTokenVerifier())
      .overrideProvider(ObisPort)
      .useValue(new FakeObis())
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

  it('kimlik ve yetki: belirteçsiz 401, rolü atanmamış kullanıcı 403', async () => {
    await request(app.getHttpServer()).get('/api/v1/me').expect(401);
    await as('yeni.personel').get('/offerings').expect(403);
  });

  it('başvuru girişi: öğrenci no ile uygunluk ve yola göre zorunlu belgeler', async () => {
    const res = await as('birim.iibf').get('/intake/candidates?studentNo=230201001&type=CAP').expect(200);
    expect(res.body.student.fullName).toBe('Ayşe Demirtaş');
    const ikt = res.body.items.find((i: { offering: { id: string } }) => i.offering.id === IKT);
    expect(ikt.verdict).toBe('ELIGIBLE');
    expect(ikt.requiredDocuments.map((d: { key: string }) => d.key)).toEqual(RANK_DOCS);
    // Birim yalnızca kendi birimindeki teklifleri görür
    expect(res.body.items.every((i: { offering: { unitName: string } }) => i.offering.unitName === 'İktisadi ve İdari Bilimler Fakültesi')).toBe(true);
  });

  it('başvuru girişi: eksik belge 422, başka birim 403, takvim dışı tarih 409', async () => {
    const missing = await as('birim.iibf').post('/applications', intake('230201001', { documents: ['DILEKCE'] })).expect(422);
    expect(missing.body.errors.map((e: { path: string }) => e.path)).toEqual(['TRANSKRIPT', 'OGRENCI_BELGESI', 'BASARI_BELGESI']);
    await as('birim.fen').post('/applications', intake('230201001')).expect(403);
    await as('birim.iibf').post('/applications', intake('230201001', { documentDate: '2026-08-01' })).expect(409);
  });

  it('başvuru girişi: uygunlar kaydedilir; koşulu sağlamayan INELIGIBLE olarak kayda geçer', async () => {
    for (const s of ['230201001', '230201002', '230201030', '230201031', '230201032', '230201033']) {
      const r = await as('birim.iibf').post('/applications', intake(s)).expect(201);
      expect(r.body.application.status).toBe('SUBMITTED');
    }
    const low = await as('birim.iibf').post('/applications', intake('230201003')).expect(201);
    expect(low.body.application.status).toBe('INELIGIBLE');
    expect(low.body.results.find((r: { code: string }) => r.code === 'KR-ÇAP-02').status).toBe('FAIL');
    await as('birim.iibf').post('/applications', intake('230201001')).expect(409);
  });

  it('YKS yolu: ÖSYM doğrulaması ve YKS belgeleri', async () => {
    const no = await as('birim.iibf').post('/applications', intake('230301004')).expect(422);
    expect(no.body.needsOsym).toBe(true);
    await as('birim.iibf').post('/applications', intake('230301004', { osymDocNo: 'YKS2025-0001234', osymVerificationCode: 'YANLIS' })).expect(422);
    const docs = await as('birim.iibf')
      .post('/applications', intake('230301004', { osymDocNo: 'YKS2025-0001234', osymVerificationCode: 'AB12CD' }))
      .expect(422);
    expect(docs.body.errors.map((e: { path: string }) => e.path)).toEqual(['YKS_SONUC', 'YKS_YERLESTIRME']);
    const ok = await as('birim.iibf')
      .post('/applications', intake('230301004', { osymDocNo: 'YKS2025-0001234', osymVerificationCode: 'AB12CD', documents: ['DILEKCE', 'TRANSKRIPT', 'OGRENCI_BELGESI', 'YKS_SONUC', 'YKS_YERLESTIRME'] }))
      .expect(201);
    expect(ok.body.application.path).toBe('ENTRY_SCORE');
  });

  it('dilekçeyle geri çekme gerekçe ister', async () => {
    const list = await as('birim.iibf').get(`/applications?offeringId=${IKT}&studentNo=230201002`).expect(200);
    await as('birim.iibf').post(`/applications/${list.body[0].id}/withdraw`, { reason: 'x' }).expect(400);
    await as('birim.iibf').post(`/applications/${list.body[0].id}/withdraw`, { reason: 'Öğrenci dilekçesi E-2026/991' }).expect(201);
  });

  it('değerlendirme: pencere kapanır, GNO sırası, kilit, karar ve yayın', async () => {
    await as('koord.iktisat').post(`/offerings/${IKT}/ranking/lock`).expect(409);
    await as('birim.iibf').post('/units/U-IIBF/windows/close-now', { termId: TERM, type: 'CAP' }).expect(201);
    const list = await as('koord.iktisat').get(`/offerings/${IKT}/applications`).expect(200);
    const rows = list.body.rows as { studentNo: string; ranking: { proposal: string } }[];
    expect(rows.map((r) => r.studentNo)).toEqual(['230201030', '230201031', '230201032', '230201001', '230201033', '230301004']);
    expect(rows.filter((r) => r.ranking.proposal === 'ASIL')).toHaveLength(4);
    await as('koord.iktisat').post(`/offerings/${IKT}/ranking/lock`).expect(201);
    await as('birim.iibf').post(`/offerings/${IKT}/decision`, { decisionDate: '2026-10-08', decisionNo: '2026/45-3' }).expect(201);
    await as('birim.iibf').post(`/offerings/${IKT}/publish`).expect(201);
  });

  it('kesin kayıt: belge kontrolü, sonra kayıt ve ÇAP danışmanı', async () => {
    const list = await as('birim.iibf').get(`/applications?offeringId=${IKT}&studentNo=230201001`).expect(200);
    const id = list.body[0].id;
    const miss = await as('birim.iibf').post(`/applications/${id}/register`, { documents: ['KAYIT_DILEKCESI'] }).expect(422);
    expect(miss.body.errors.length).toBe(ALL_REG_DOCS.length - 1);
    const e = await as('birim.iibf').post(`/applications/${id}/register`, { documents: ALL_REG_DOCS }).expect(201);
    ayseEnrollment = e.body.id;
    expect(e.body.trackAdvisorUsername).toBe('koord.iktisat');
  });

  it('protokol: kural denetimi, beş imza, ret ve yeniden gönderme, dosyalama', async () => {
    const d = await as('koord.iktisat').get(`/enrollments/${ayseEnrollment}`).expect(200);
    expect(d.body.protocolOptions.commonEcts).toBe(14);
    const all: string[] = d.body.protocolOptions.courses.filter((c: { inMain: boolean }) => !c.inMain).map((c: { code: string }) => c.code);

    const few = await as('koord.iktisat').put(`/enrollments/${ayseEnrollment}/protocol`, { courseCodes: all.slice(0, 10) }).expect(200);
    expect(few.body.results.find((r: { code: string }) => r.code === 'KR-ÇAP-18').status).toBe('FAIL');
    await as('koord.iktisat').post(`/enrollments/${ayseEnrollment}/protocol/submit`).expect(422);
    await as('birim.iibf').put(`/enrollments/${ayseEnrollment}/protocol`, { courseCodes: all }).expect(403);

    const full = await as('koord.iktisat').put(`/enrollments/${ayseEnrollment}/protocol`, { courseCodes: all }).expect(200);
    expect(full.body.results.every((r: { status: string }) => r.status === 'PASS')).toBe(true);
    await as('koord.iktisat').post(`/enrollments/${ayseEnrollment}/protocol/submit`).expect(201);

    const approvals = await prisma.approval.findMany({ where: { subjectType: 'PROTOCOL', round: 1, subjectId: (await prisma.protocol.findUniqueOrThrow({ where: { enrollmentId: ayseEnrollment } })).id } });
    expect(Object.fromEntries(approvals.map((a) => [a.role, a.assigneeUsername]))).toEqual({
      OGRENCI_IMZA: 'koord.iktisat',
      ANA_DAL_DANISMANI: 'danisman.isletme',
      ANA_DAL_BOLUM_BASKANI: 'bolum.isletme',
      KOORDINATOR: 'koord.iktisat',
      HEDEF_BOLUM_BASKANI: 'bolum.iktisat',
    });

    const mine = await as('danisman.isletme').get('/approvals/mine').expect(200);
    expect(mine.body).toHaveLength(1);
    await as('bolum.iktisat').post(`/approvals/${mine.body[0].id}`, { decision: 'APPROVED' }).expect(403);

    // Ana dal bölüm başkanı reddeder → protokol REJECTED, bekleyen imzalar düşer
    const head = await as('bolum.isletme').get('/approvals/mine').expect(200);
    await as('bolum.isletme').post(`/approvals/${head.body[0].id}`, { decision: 'REJECTED' }).expect(400);
    await as('bolum.isletme').post(`/approvals/${head.body[0].id}`, { decision: 'REJECTED', comment: 'Seçmeli ders dengesi gözden geçirilsin' }).expect(201);
    expect((await prisma.protocol.findUniqueOrThrow({ where: { enrollmentId: ayseEnrollment } })).status).toBe('REJECTED');
    expect((await as('danisman.isletme').get('/approvals/mine')).body).toHaveLength(0);

    // Yeniden gönderme yeni imza turu açar
    await as('koord.iktisat').post(`/enrollments/${ayseEnrollment}/protocol/submit`).expect(201);
    for (const u of ['koord.iktisat', 'danisman.isletme', 'bolum.isletme', 'bolum.iktisat']) {
      const pending = await as(u).get('/approvals/mine').expect(200);
      for (const a of pending.body) await as(u).post(`/approvals/${a.id}`, { decision: 'APPROVED' }).expect(201);
    }
    const p = await prisma.protocol.findUniqueOrThrow({ where: { enrollmentId: ayseEnrollment } });
    expect(p.status).toBe('APPROVED');
    expect(p.round).toBe(2);
    await as('koord.iktisat').post(`/enrollments/${ayseEnrollment}/protocol/file`).expect(403);
    await as('birim.iibf').post(`/enrollments/${ayseEnrollment}/protocol/file`).expect(201);
  });

  it('dönemlik ders kaydı: onaylar, toplu teslim, OBİS listesi', async () => {
    const d = await as('koord.iktisat').get(`/enrollments/${ayseEnrollment}`).expect(200);
    const codes = d.body.protocol.courses.slice(0, 5).map((c: { code: string }) => c.code);
    await as('koord.iktisat').put(`/enrollments/${ayseEnrollment}/course-registration`, { termId: TERM, courseCodes: ['YOK999'] }).expect(422);
    await as('koord.iktisat').put(`/enrollments/${ayseEnrollment}/course-registration`, { termId: TERM, courseCodes: codes }).expect(200);
    await as('koord.iktisat').post(`/enrollments/${ayseEnrollment}/course-registration/submit`, { termId: TERM }).expect(201);
    const reg = await prisma.courseRegistration.findFirstOrThrow({ where: { enrollmentId: ayseEnrollment } });
    expect(await prisma.approval.count({ where: { subjectId: reg.id } })).toBe(5);
    for (const u of ['koord.iktisat', 'danisman.isletme', 'bolum.isletme', 'bolum.iktisat']) {
      const pending = await as(u).get('/approvals/mine').expect(200);
      for (const a of pending.body) await as(u).post(`/approvals/${a.id}`, { decision: 'APPROVED' }).expect(201);
    }
    expect((await prisma.courseRegistration.findUniqueOrThrow({ where: { id: reg.id } })).status).toBe('APPROVED');

    const tasks = await as('koord.iktisat').get('/me/tasks').expect(200);
    expect(tasks.body.tasks.map((t: { key: string }) => t.key)).toContain('batch');
    await as('koord.iktisat').post('/course-registrations/submit-batch', { termId: TERM }).expect(201);

    const unitTasks = await as('birim.iibf').get('/me/tasks').expect(200);
    expect(unitTasks.body.tasks.find((t: { key: string }) => t.key === 'obis').count).toBe(1);
    const csv = await as('birim.iibf').get(`/course-registrations/export?termId=${TERM}`).expect(200);
    expect(csv.text).toContain(codes[0]);
    await as('birim.iibf').post('/course-registrations/mark-entered', { ids: [reg.id] }).expect(201);
    expect((await prisma.courseRegistration.findUniqueOrThrow({ where: { id: reg.id } })).status).toBe('ENTERED');
  });

  it('dönem izni: Erasmus döneminde ders kaydı yapılamaz; taramada ders almama sayılmaz', async () => {
    const gizem = await prisma.enrollment.findFirstOrThrow({ where: { studentNo: '220601010' } });
    await as('birim.iletisim').post(`/enrollments/${gizem.id}/leaves`, { termId: TERM, reason: 'ERASMUS', note: 'Erasmus 2026-27 güz' }).expect(201);
    const r = await as('koord.halkla-iliskiler').put(`/enrollments/${gizem.id}/course-registration`, { termId: TERM, courseCodes: ['HIT103'] }).expect(409);
    expect(r.body.detail).toContain('Erasmus');
  });

  it('dönem sonu taraması: GNO alt sınırı (K-2), izinli öğrenci hariç, birim kararı', async () => {
    const scan = await as('oidb.yonetici').post('/scans', { termId: TERM }).expect(201);
    await app.get(MonitoringService).run(scan.body.id);
    const result = await as('oidb.yonetici').get(`/scans/${scan.body.id}`).expect(200);
    const codes = result.body.findings.map((f: { studentNo: string; ruleCode: string; status: string }) => `${f.studentNo}:${f.ruleCode}:${f.status}`);
    expect(codes).toEqual(expect.arrayContaining(['220301008:KR-YD-06:FAIL', '220201009:KR-ÇAP-11:FAIL', '220201023:KR-ÇAP-12:WARN']));
    expect(codes.some((c: string) => c.startsWith('220601010:KR-ÇAP-10'))).toBe(false);

    const f = result.body.findings.find((x: { studentNo: string }) => x.studentNo === '220301008');
    await as('birim.iibf').patch(`/scan-findings/${f.id}`, { decision: 'CONFIRMED', reason: 'Yönetim kurulu 2026/46-2' }).expect(200);
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: f.enrollmentId } })).status).toBe('REMOVED');
  });

  it('ayrılma: birim dilekçeyle işler; ÇAP → yan dal sertifikası hakkı', async () => {
    const e = await prisma.enrollment.findFirstOrThrow({ where: { studentNo: '220401011' } });
    await as('koord.istatistik').post(`/enrollments/${e.id}/withdrawal`, { reason: 'Öğrenci dilekçesi' }).expect(403);
    const res = await as('birim.fen').post(`/enrollments/${e.id}/withdrawal`, { reason: 'Öğrenci dilekçesi E-2026/1200' }).expect(201);
    expect(res.body.outcome.eligibleForCertificate).toBe(true);
  });

  it('ÖİDB: rol atama ile yeni personel yetki kazanır; denetim kaydı listelenir', async () => {
    await as('yeni.personel').get('/me').expect(200); // ilk giriş kaydı
    await as('oidb.yonetici').post('/users/yeni.personel/assignments', { role: 'BIRIM' }).expect(400);
    await as('oidb.yonetici').post('/users/yeni.personel/assignments', { role: 'BIRIM', unitId: 'U-FEN' }).expect(201);
    await as('yeni.personel').get('/offerings').expect(200);
    const audit = await as('oidb.yonetici').get('/audit?action=ROLE_ASSIGN').expect(200);
    expect(audit.body[0].actor).toBe('oidb.yonetici');
    await as('birim.iibf').get('/audit').expect(403);
  });

  it('denetim kaydı değiştirilemez', async () => {
    await expect(prisma.$executeRawUnsafe('DELETE FROM "AuditLog"')).rejects.toThrow(/değiştirilemez/);
  });
});
