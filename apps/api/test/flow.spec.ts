/**
 * Bilgisayar Mühendisliği ÇAP / yan dal otomasyonu — uçtan uca API akışı
 * (gerçek PostgreSQL test veritabanı; sahte belirteç doğrulayıcı). docs/KARARLAR.md K-12.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { TokenVerifier } from '../src/auth/auth';
import { ProblemFilter } from '../src/common/http';
import { MonitoringService } from '../src/monitoring/monitoring';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakeTokenVerifier } from './fakes';

const CAP = 'O-2026-GUZ-CAP';
const YANDAL = 'O-2026-GUZ-YANDAL';
const TERM = 'T-2026-GUZ';
const AYSE = '253302001';
const MEHMET = '253302002';
const ZEYNEP = '253302003';
const EMRE = '253302004';
const SELIN = '233302007';
const KEREM = '253303008';
const BUSRA = '253302009';
const CAN = '253302010';
const DENIZ = '253302011';
const MERT = '253302012';
const GIZEM = '243302013';
const ONUR = '243303014';
const HAKAN = '243302015';
const IREM = '243302016';
const TOLGA = '243303017';
const KOORD = 'koord.bilgisayar';
const HEAD = 'bolum.bilgisayar';
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< >>\nendobj\ntrailer\n<< >>\n%%EOF\n', 'latin1');

interface Item {
  offering: { id: string };
  verdict: string;
  path: string;
  results: { code: string; status: string }[];
  missingDocuments: { key: string }[];
}

describe('Bölüm otomasyonu akışı', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ayse: string; // kayıt kimliği
  const appIds: Record<string, string> = {};

  const http = () => request(app.getHttpServer());
  const as = (user: string) => ({
    get: (url: string) => http().get(`/api/v1${url}`).set('authorization', `Bearer ${user}`),
    post: (url: string, body?: object) => http().post(`/api/v1${url}`).set('authorization', `Bearer ${user}`).send(body ?? {}),
    put: (url: string, body: object) => http().put(`/api/v1${url}`).set('authorization', `Bearer ${user}`).send(body),
    patch: (url: string, body: object) => http().patch(`/api/v1${url}`).set('authorization', `Bearer ${user}`).send(body),
    del: (url: string) => http().delete(`/api/v1${url}`).set('authorization', `Bearer ${user}`),
    upload: (kind: string, file: Buffer, name = 'belge.pdf') => http().post('/api/v1/me/documents').set('authorization', `Bearer ${user}`).field('kind', kind).attach('file', file, name),
  });
  const offeringOf = async (user: string, id: string) => ((await as(user).get('/me/eligibility').expect(200)).body.items as Item[]).find((i) => i.offering.id === id)!;
  const apply = (user: string, offeringId = CAP) => as(user).post('/applications', { offeringId, declaration: true });
  const pending = async (user: string) => (await as(user).get('/approvals/mine').expect(200)).body as { id: string; role: string; proxy: boolean; subject: { kind: string }; enrollment: { studentNo: string } }[];
  const signAll = async (user: string) => {
    for (const a of await pending(user)) await as(user).post(`/approvals/${a.id}`, { decision: 'APPROVED' }).expect(201);
  };
  const detail = async (user: string, id: string) => (await as(user).get(`/enrollments/${id}`).expect(200)).body;
  const enrollmentOf = async (studentNo: string) => (await prisma.enrollment.findFirstOrThrow({ where: { studentNo } })).id;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(TokenVerifier).useValue(new FakeTokenVerifier()).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new ProblemFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('kimlik ve yetki: belirteçsiz 401; rol atanmamış hesap öğrencidir; ana dal imzacıları bölüm verisini göremez', async () => {
    await http().get('/api/v1/me').expect(401);
    const me = await as('yeni.ogrenci').get('/me').expect(200);
    expect(me.body.roles).toEqual(['OGRENCI']);
    await as('yeni.ogrenci').get('/offerings').expect(403);
    await as('danisman.eem').get('/applications').expect(403);
    // Ana dal bölüm başkanı BOLUM_BASKANI rolündedir ama kapsamı kendi bölümüdür.
    await as('bolum.eem').get('/applications').expect(403);
    await as('bolum.eem').get('/users').expect(403);
    const head = await as(HEAD).get('/me').expect(200);
    expect(head.body.homeHead).toBe(true);
    const open = await http().get('/api/v1/offerings/public').expect(200);
    expect(open.body.offerings.map((o: { type: string }) => o.type)).toEqual(['CAP', 'YANDAL']);
  });

  it('öğrenci bilgilerini kendisi girer; alanlar denetlenir, öğrenci numarası sonradan değişmez', async () => {
    const before = await as(MERT).get('/me/profile').expect(200);
    expect(before.body.profile).toBeNull();
    expect((await as(MERT).get('/me/eligibility').expect(200)).body.hasProfile).toBe(false);
    await apply(MERT).expect(409);

    const body = { studentNo: MERT, fullName: 'Mert Güneş', email: 'mert@ogrenci.test', programId: 'P-EEM', entryYear: 2025, semesterNo: 3, gano: 3.3, completedAllCourses: true, classRank: 9, classSize: 82, entryScore: 385, successRank: 110000, advisorUsername: 'danisman.eem' };
    await as(MERT).put('/me/profile', { ...body, gano: 4.5 }).expect(400);
    await as(MERT).put('/me/profile', { ...body, classRank: 90 }).expect(400);
    await as(MERT).put('/me/profile', { ...body, programId: 'P-BIL' }).expect(422);
    await as(MERT).put('/me/profile', { ...body, advisorUsername: 'danisman.makine' }).expect(422);
    await as(MERT).put('/me/profile', { ...body, studentNo: AYSE }).expect(409);
    await as(MERT).put('/me/profile', body).expect(200);
    await as(MERT).put('/me/profile', { ...body, studentNo: '253302099' }).expect(409);
    await as(MERT).put('/me/profile', { ...body, gano: 3.35 }).expect(200);
    const after = await as(MERT).get('/me/profile').expect(200);
    expect(after.body.profile).toMatchObject({ studentNo: MERT, gano: 3.35, classRankPercentile: 11 });
    // Personel hesabı öğrenci bilgisi giremez.
    await as(KOORD).put('/me/profile', body).expect(403);
  });

  it('belge yükleme: içerik türü denetlenir; belgeyi yalnız sahibi ve ilgili personel görür', async () => {
    await as(MERT).upload('YKS_BELGESI', Buffer.from('MZ bu bir pdf değil')).expect(400);
    await as(MERT).upload('BILINMEYEN', PDF).expect(400);
    const doc = await as(MERT).upload('YKS_BELGESI', PDF, 'yks-sonuç.pdf').expect(201);
    expect(doc.body).toMatchObject({ kind: 'YKS_BELGESI', fileName: 'yks-sonuç.pdf', mimeType: 'application/pdf' });
    await as(MERT).get(`/documents/${doc.body.id}`).expect(200).expect('content-type', /pdf/);
    await as(AYSE).get(`/documents/${doc.body.id}`).expect(403);
    await as('danisman.makine').get(`/documents/${doc.body.id}`).expect(403);
    await as('danisman.eem').get(`/documents/${doc.body.id}`).expect(200);
    await as(KOORD).get(`/documents/${doc.body.id}`).expect(200);
    const extra = await as(MERT).upload('DIGER', PDF).expect(201);
    await as(MERT).del(`/me/documents/${extra.body.id}`).expect(200);
  });

  it('uygunluk: öğrencinin girdiği bilgilerle kurallar anında çalışır', async () => {
    const a = await offeringOf(AYSE, CAP);
    expect(a.verdict).toBe('ELIGIBLE');
    expect(a.path).toBe('RANK');
    const z = await offeringOf(ZEYNEP, CAP);
    expect(z.verdict).toBe('INELIGIBLE');
    expect(z.results.find((r) => r.code === 'KR-ÇAP-02')?.status).toBe('FAIL');
    expect((await offeringOf(ZEYNEP, YANDAL)).verdict).toBe('ELIGIBLE');
    // 2026-27 güz ilanı: ÇAP yalnız Elektrik-Elektronik Müh. öğrencilerine açık.
    const k = await offeringOf(KEREM, CAP);
    expect(k.results.find((r) => r.code === 'KR-ÇAP-08')?.status).toBe('FAIL');
    expect((await offeringOf(KEREM, YANDAL)).verdict).toBe('ELIGIBLE');
    expect((await offeringOf(SELIN, CAP)).results.find((r) => r.code === 'KR-ÇAP-05')?.status).toBe('FAIL');
    // Taban puan yolu: belge doğrulanana kadar koşullu.
    const e = await offeringOf(EMRE, CAP);
    expect(e.verdict).toBe('CONDITIONAL');
    expect(e.path).toBe('ENTRY_SCORE');
    // Mühendislikte başarı sırası şartı (300.000): sağlamayan elenir.
    await prisma.studentProfile.update({ where: { studentNo: SELIN }, data: { successRank: 310000 } });
    expect((await offeringOf(SELIN, CAP)).results.find((r) => r.code === 'KR-ÇAP-04')?.status).toBe('FAIL');
  });

  it('başvuru: zorunlu belge yoksa alınmaz; beyan anlık görüntü olarak saklanır', async () => {
    // Yan dalda transkript zorunlu; Mert yalnız YKS belgesi yükledi.
    const missing = await apply(MERT, YANDAL).expect(422);
    expect(missing.body.errors.map((e: { path: string }) => e.path)).toEqual(['TRANSKRIPT']);
    await as(AYSE).post('/applications', { offeringId: CAP }).expect(400); // beyan onayı yok

    for (const s of [AYSE, BUSRA, CAN, DENIZ, MEHMET, EMRE, MERT]) {
      const res = await apply(s).expect(201);
      expect(res.body.application.status).toBe('SUBMITTED');
      appIds[s] = res.body.application.id;
    }
    const z = await apply(ZEYNEP).expect(201);
    expect(z.body.application.status).toBe('INELIGIBLE');
    await apply(AYSE).expect(409);

    // Bilgiler sonradan değişse de başvuru, verildiği andaki beyanı saklar.
    const app1 = await as(KOORD).get(`/applications/${appIds[AYSE]}`).expect(200);
    expect(app1.body.snapshot.declared).toMatchObject({ gano: 3.1, classRank: 5, classSize: 82 });
    expect(app1.body.documents.map((d: { kind: string }) => d.kind)).toEqual(['YKS_BELGESI']);
    expect(app1.body.sameFaculty).toBe(true);
    await as(BUSRA).get(`/applications/${appIds[AYSE]}`).expect(403);
    await as(MERT).post(`/applications/${appIds[MERT]}/withdraw`, { reason: 'Vazgeçtim, başvurumu geri çekiyorum' }).expect(201);
    expect((await as(KOORD).get('/applications?verification=PENDING').expect(200)).body.length).toBeGreaterThanOrEqual(6);
  });

  it('doğrulama ve sıralama: beyanlar doğrulanmadan kilitlenmez; uyuşmayan başvuru elenir', async () => {
    await as(AYSE).post(`/offerings/${CAP}/close-now`).expect(403);
    await as(KOORD).post(`/offerings/${CAP}/close-now`).expect(201);
    await apply(SELIN).expect(409);
    const locked = await as(KOORD).post(`/offerings/${CAP}/ranking/lock`).expect(409);
    expect(locked.body.detail).toMatch(/doğrulanmadı/);

    const v = await as(KOORD).post(`/applications/${appIds[EMRE]}/verify`, { status: 'VERIFIED', note: 'YKS belgesi: 401,2' }).expect(201);
    expect(v.body.eligibility.verdict).toBe('ELIGIBLE');
    await as(KOORD).post(`/applications/${appIds[MEHMET]}/verify`, { status: 'MISMATCH' }).expect(422);
    const m = await as(KOORD).post(`/applications/${appIds[MEHMET]}/verify`, { status: 'MISMATCH', note: 'Transkriptte GNO 2,68; beyan 2,75' }).expect(201);
    expect(m.body.status).toBe('INELIGIBLE');
    await as(AYSE).post(`/applications/${appIds[AYSE]}/verify`, { status: 'VERIFIED' }).expect(403);
    for (const s of [AYSE, BUSRA, CAN, DENIZ]) await as(KOORD).post(`/applications/${appIds[s]}/verify`, { status: 'VERIFIED' }).expect(201);

    const list = await as(KOORD).get(`/offerings/${CAP}/applications`).expect(200);
    expect(list.body.rows.map((r: { studentNo: string; ranking: { proposal: string } }) => [r.studentNo, r.ranking.proposal])).toEqual([
      [BUSRA, 'ASIL'],
      [CAN, 'ASIL'],
      [AYSE, 'ASIL'],
      [DENIZ, 'YEDEK'],
      [EMRE, 'YEDEK'],
    ]);
    await as(HEAD).post(`/offerings/${CAP}/ranking/lock`).expect(403);
    await as(KOORD).post(`/offerings/${CAP}/ranking/lock`).expect(201);
    await as(KOORD).patch(`/offerings/${CAP}`, { quota: 5 }).expect(409);
    // Sonuç ilan edilene kadar öğrenci kurul sonucunu görmez.
    const mine = await as(AYSE).get('/me/applications').expect(200);
    expect(mine.body[0]).toMatchObject({ status: 'UNDER_REVIEW', rank: null });
  });

  it('karar, ilan ve kesin kayıt: öğrenci kaydını kendisi onaylar; kaydolmayanın yerine yedek çağrılır', async () => {
    await as(KOORD).post(`/offerings/${CAP}/decision`, { decisionDate: '2026-10-08', decisionNo: '2026/41-7' }).expect(201);
    await as(AYSE).post(`/applications/${appIds[AYSE]}/accept`).expect(409); // henüz ilan edilmedi
    await as(KOORD).post(`/offerings/${CAP}/publish`).expect(201);
    const result = await as(KOORD).get(`/offerings/${CAP}/result`).expect(200);
    expect(result.body.rows[0]).toMatchObject({ studentNo: '253***009', proposal: 'ASIL' });

    const mine = await as(AYSE).get('/me/applications').expect(200);
    expect(mine.body[0]).toMatchObject({ status: 'ACCEPTED', rank: 3, registrationOpen: true });
    await as(DENIZ).post(`/applications/${appIds[DENIZ]}/accept`).expect(409);
    await as(BUSRA).post(`/applications/${appIds[AYSE]}/accept`).expect(403);
    const e = await as(AYSE).post(`/applications/${appIds[AYSE]}/accept`).expect(201);
    ayse = e.body.id;
    expect(e.body.mainAdvisorUsername).toBe('danisman.eem');

    const closed = await as(KOORD).post(`/offerings/${CAP}/close-registration`).expect(201);
    expect(closed.body).toMatchObject({ dropped: 2, promoted: [DENIZ, EMRE], closed: false });
    await as(DENIZ).post(`/applications/${appIds[DENIZ]}/accept`).expect(201);
    const xlsx = await as(KOORD).get(`/offerings/${CAP}/export?format=xlsx`).expect(200);
    expect(xlsx.headers['content-type']).toMatch(/spreadsheet/);
  });

  it('protokol: gerçek EEM şablonundan üretilir (135 + 105 AKTS), beş imza; ret yeni tur açar', async () => {
    await as(AYSE).put(`/enrollments/${ayse}/protocol`, {}).expect(403);
    const created = await as(KOORD).put(`/enrollments/${ayse}/protocol`, {}).expect(200);
    expect(created.body.results.find((r: { code: string }) => r.code === 'KR-ÇAP-18')).toMatchObject({ status: 'PASS', actual: 240 });
    let d = await detail(KOORD, ayse);
    expect(d.protocol.courses).toHaveLength(28);
    expect(d.protocol.courses.filter((c: { kind: string }) => c.kind === 'ELECTIVE_SLOT')).toHaveLength(8);
    expect(d.exemptions).toHaveLength(8);
    await as(KOORD).post(`/enrollments/${ayse}/protocol/submit`).expect(201);

    // Koordinatörün imzası gönderimle atılır; kalan dört imzacının her birinde bir bekleyen imza vardır.
    expect(await pending(KOORD)).toHaveLength(0);
    for (const u of [AYSE, 'danisman.eem', 'bolum.eem', HEAD]) expect((await pending(u)).filter((a) => a.enrollment.studentNo === AYSE)).toHaveLength(1);
    expect(await pending('danisman.makine')).toHaveLength(0);
    const [headApproval] = await pending('bolum.eem');
    await as('danisman.makine').post(`/approvals/${headApproval.id}`, { decision: 'APPROVED' }).expect(403);
    await as('bolum.eem').post(`/approvals/${headApproval.id}`, { decision: 'REJECTED' }).expect(400);
    await as('bolum.eem').post(`/approvals/${headApproval.id}`, { decision: 'REJECTED', comment: 'Öğrencinin danışmanı değişti' }).expect(201);
    d = await detail(AYSE, ayse);
    expect(d.protocol.status).toBe('REJECTED');
    expect(await pending(AYSE)).toHaveLength(0);

    await as(KOORD).post(`/enrollments/${ayse}/protocol/submit`).expect(201);
    for (const u of [AYSE, 'danisman.eem', 'bolum.eem', HEAD]) await signAll(u);
    d = await detail(AYSE, ayse);
    expect(d.protocol).toMatchObject({ status: 'APPROVED', round: 2 });
    expect(d.protocol.approvals.filter((a: { round: number; decision: string }) => a.round === 2 && a.decision === 'APPROVED')).toHaveLength(5);
    await as(KOORD).put(`/enrollments/${ayse}/protocol`, {}).expect(409);
    // Başka bölümün öğrencisinin kaydını ana dal imzacıları göremez.
    await as('danisman.makine').get(`/enrollments/${ayse}`).expect(403);
    await as(BUSRA).get(`/enrollments/${ayse}`).expect(403);
  });

  it('hesabı olmayan imzacı: ıslak imzayı koordinatör işler', async () => {
    const deniz = await enrollmentOf(DENIZ);
    await prisma.enrollment.update({ where: { id: deniz }, data: { mainAdvisorUsername: null } });
    await as(KOORD).put(`/enrollments/${deniz}/protocol`, {}).expect(200);
    await as(KOORD).post(`/enrollments/${deniz}/protocol/submit`).expect(201);
    const proxy = (await pending(KOORD)).filter((a) => a.enrollment.studentNo === DENIZ);
    expect(proxy).toHaveLength(1);
    expect(proxy[0]).toMatchObject({ role: 'ANA_DAL_DANISMANI', proxy: true });
    await as(KOORD).post(`/approvals/${proxy[0].id}`, { decision: 'APPROVED' }).expect(201);
    const d = await detail(KOORD, deniz);
    expect(d.protocol.approvals.find((a: { role: string }) => a.role === 'ANA_DAL_DANISMANI').comment).toMatch(/Islak imza/);
  });

  it('ders kayıt formu (FORM01): öğrenci hazırlar; öğrenci, ana dal danışmanı ve koordinatör imzalar', async () => {
    let d = await detail(AYSE, ayse);
    const opts = d.registrationOptions as { protocolCourseId: string; kind: string; code: string | null; semester: number; choices: { code: string }[] }[];
    const giris = opts.find((o) => o.code === '3301156')!;
    const nyp = opts.find((o) => o.code === '3301351')!;
    const slot5 = opts.find((o) => o.kind === 'ELECTIVE_SLOT' && o.semester === 5)!;
    expect(slot5.choices.some((c) => c.code === '3301561')).toBe(true);
    const save = (items: object[]) => as(AYSE).put(`/enrollments/${ayse}/course-registration`, { termId: TERM, items });

    await save([{ protocolCourseId: slot5.protocolCourseId }]).expect(422); // seçmeli yer için ders seçilmedi
    await save([{ protocolCourseId: slot5.protocolCourseId, courseCode: '3301661' }]).expect(422); // 6. yarıyıl seçmelisi 5. yarıyıl yerine yazılamaz
    await as(AYSE).put(`/enrollments/${ayse}/course-registration`, { termId: 'T-2025-GUZ', items: [{ protocolCourseId: giris.protocolCourseId }] }).expect(409);
    await as(BUSRA).put(`/enrollments/${ayse}/course-registration`, { termId: TERM, items: [{ protocolCourseId: giris.protocolCourseId }] }).expect(403);
    await save([{ protocolCourseId: giris.protocolCourseId }, { protocolCourseId: nyp.protocolCourseId }, { protocolCourseId: slot5.protocolCourseId, courseCode: '3301562' }]).expect(200);
    await as(AYSE).post(`/enrollments/${ayse}/course-registration/submit`, { termId: TERM }).expect(201);

    d = await detail(AYSE, ayse);
    const reg = d.courseRegistrations[0];
    expect(reg.status).toBe('IN_APPROVAL');
    expect(reg.approvals.map((a: { role: string; decision: string }) => [a.role, a.decision])).toEqual([
      ['OGRENCI', 'APPROVED'],
      ['ANA_DAL_DANISMANI', 'PENDING'],
      ['KOORDINATOR', 'PENDING'],
    ]);
    await save([{ protocolCourseId: giris.protocolCourseId }]).expect(409);
    await signAll('danisman.eem');
    await signAll('koord.uye'); // komisyonun herhangi bir üyesi imzalayabilir
    d = await detail(AYSE, ayse);
    expect(d.courseRegistrations[0].status).toBe('APPROVED');
  });

  it('not girişi: koordinatör girer; geçilen ders ve seçmeli yer protokolde işlenir', async () => {
    let d = await detail(KOORD, ayse);
    const items = d.courseRegistrations[0].items as { id: string; code: string }[];
    const id = (code: string) => items.find((i) => i.code === code)!.id;
    await as(AYSE).put(`/enrollments/${ayse}/grades`, { grades: [{ itemId: id('3301156'), grade: 'AA', passed: true }] }).expect(403);
    await as(KOORD)
      .put(`/enrollments/${ayse}/grades`, { grades: [{ itemId: id('3301156'), grade: 'BA', passed: true }, { itemId: id('3301351'), grade: 'FF', passed: false }, { itemId: id('3301562'), grade: 'BB', passed: true }] })
      .expect(200);
    d = await detail(AYSE, ayse);
    const by = (code: string) => d.protocol.courses.find((c: { code: string | null; fulfilledCode: string | null }) => c.code === code || c.fulfilledCode === code);
    expect(by('3301156')).toMatchObject({ status: 'PASSED', grade: 'BA' });
    expect(by('3301351')).toMatchObject({ status: 'FAILED', grade: 'FF' });
    expect(by('3301562')).toMatchObject({ kind: 'ELECTIVE_SLOT', status: 'PASSED', fulfilledName: 'Tasarım Desenleri' });
    // (3,5×4 + 0×4 + 3×4) / 12 = 2,17
    expect(d.progress).toMatchObject({ trackEcts: 8, requiredEcts: 135, trackGpa: 2.17 });
    expect(d.progress.graduation.status).toBe('FAIL');
    await as(KOORD).post(`/enrollments/${ayse}/complete`, { mainGano: 3.2 }).expect(422);
  });

  it('özel şartlı ders muafiyeti: ana dalda alınan ders protokoldeki dersten muaf sayar', async () => {
    let d = await detail(AYSE, ayse);
    const cond = (no: number) => d.exemptions.find((x: { no: number }) => x.no === no);
    expect(cond(1)).toMatchObject({ sourceCourseCode: '3302458', targetCourseCode: '3301354', available: true });
    // Şart 2'nin karşılığı bir seçmeli derstir: 5. yarıyılın boş seçmeli yeri kullanılır.
    expect(cond(2).targetLabel).toMatch(/5\. Yarıyıl Teknik Seçmeli Ders \(Sinyal İşleme\)/);
    const post = (user: string, body: object) => as(user).post(`/enrollments/${ayse}/exemptions`, body);
    await post(AYSE, { conditionId: cond(1).id, sourceGrade: 'FF', sourceTerm: '2025-2026 Bahar' }).expect(422);
    await post(BUSRA, { conditionId: cond(1).id, sourceGrade: 'BB', sourceTerm: '2025-2026 Bahar' }).expect(403);
    await post(AYSE, { conditionId: cond(1).id, sourceGrade: 'BB', sourceTerm: '2025-2026 Bahar' }).expect(201);
    await post(AYSE, { conditionId: cond(1).id, sourceGrade: 'BB', sourceTerm: '2025-2026 Bahar' }).expect(409);
    await post(AYSE, { conditionId: cond(2).id, sourceGrade: 'CB', sourceTerm: '2026-2027 Güz' }).expect(201);

    const mine = await pending('danisman.eem');
    expect(mine.filter((a) => a.subject.kind === 'EXEMPTION')).toHaveLength(2);
    await signAll('danisman.eem');
    const [first, second] = (await pending(KOORD)).filter((a) => a.subject.kind === 'EXEMPTION');
    await as(KOORD).post(`/approvals/${first.id}`, { decision: 'APPROVED' }).expect(201);
    await as(KOORD).post(`/approvals/${second.id}`, { decision: 'REJECTED', comment: 'Dersin notu transkriptte görünmüyor' }).expect(201);

    d = await detail(AYSE, ayse);
    expect(d.protocol.courses.find((c: { code: string }) => c.code === '3301354')).toMatchObject({ status: 'EXEMPT', grade: 'M' });
    expect(cond(1).request.status).toBe('APPROVED');
    expect(cond(2)).toMatchObject({ available: true, request: { status: 'REJECTED' } });
    // Muaf ders AKTS'ye sayılır, ortalamaya katılmaz.
    expect(d.progress).toMatchObject({ trackEcts: 12, trackGpa: 2.17 });
    // Reddedilen başvuru yenilenebilir: yeni tur açılır.
    const again = await post(AYSE, { conditionId: cond(2).id, sourceGrade: 'CB', sourceTerm: '2026-2027 Güz' }).expect(201);
    expect(again.body.round).toBe(2);
  });

  it('dönem sonu taraması: ders kayıt formları, notlar ve dönem beyanlarından çalışır', async () => {
    await as(HEAD).post('/scans', { termId: 'T-2025-BAHAR' }).expect(403);
    const scan = await as(KOORD).post('/scans', { termId: 'T-2025-BAHAR' }).expect(201);
    await app.get(MonitoringService).run(scan.body.id);
    const res = await as(KOORD).get(`/scans/${scan.body.id}`).expect(200);
    const f = (no: string) => res.body.findings.filter((x: { studentNo: string }) => x.studentNo === no) as { id: string; ruleCode: string; status: string }[];
    expect(f(GIZEM)).toHaveLength(0);
    expect(f(AYSE)).toHaveLength(0); // kaydı bu dönemden sonra başladı
    expect(f(ONUR)).toMatchObject([{ ruleCode: 'KR-ÇAP-11', status: 'WARN' }]);
    expect(f(HAKAN)).toMatchObject([{ ruleCode: 'KR-ÇAP-11', status: 'FAIL' }]);
    expect(f(IREM)).toMatchObject([{ ruleCode: 'KR-ÇAP-10', status: 'FAIL' }]);
    expect(f(TOLGA)).toHaveLength(0);

    await as(KOORD).patch(`/scan-findings/${f(HAKAN)[0].id}`, { decision: 'CONFIRMED', reason: 'Fakülte Yönetim Kurulu 2026/42-3' }).expect(200);
    await as(KOORD).patch(`/scan-findings/${f(ONUR)[0].id}`, { decision: 'CONFIRMED', reason: 'Bir defaya mahsus izin kullanıldı' }).expect(200);
    await as(KOORD).patch(`/scan-findings/${f(IREM)[0].id}`, { decision: 'DISMISSED', reason: 'Bahar döneminde ders açılmadı; izin işlenecek' }).expect(200);
    await as(KOORD).patch(`/scan-findings/${f(IREM)[0].id}`, { decision: 'CONFIRMED', reason: 'ikinci karar denemesi' }).expect(409);
    expect(await prisma.enrollment.findFirstOrThrow({ where: { studentNo: HAKAN } })).toMatchObject({ status: 'REMOVED', ganoStrikes: 2 });
    expect(await prisma.enrollment.findFirstOrThrow({ where: { studentNo: ONUR } })).toMatchObject({ status: 'ACTIVE', ganoStrikes: 1 });
    expect(await prisma.enrollment.findFirstOrThrow({ where: { studentNo: IREM } })).toMatchObject({ status: 'ACTIVE' });
  });

  it('dönem beyanı: öğrenci girer; doğrulanmamış beyana dayanan bulgu sonuç doğurmaz', async () => {
    const gizem = await enrollmentOf(GIZEM);
    await as(GIZEM).put(`/enrollments/${gizem}/term-record`, { termId: 'T-2026-BAHAR', mainGano: 2.6 }).expect(409); // dönem başlamadı
    await as(AYSE).put(`/enrollments/${gizem}/term-record`, { termId: TERM, mainGano: 2.6 }).expect(403);
    const rec = await as(GIZEM).put(`/enrollments/${gizem}/term-record`, { termId: TERM, mainGano: 2.6 }).expect(200);
    expect(rec.body.verifiedAt).toBeNull();

    const scan = await as(KOORD).post('/scans', { termId: TERM }).expect(201);
    await app.get(MonitoringService).run(scan.body.id);
    const res = await as(KOORD).get(`/scans/${scan.body.id}`).expect(200);
    const finding = res.body.findings.find((x: { studentNo: string; ruleCode: string }) => x.studentNo === GIZEM && x.ruleCode === 'KR-ÇAP-11');
    expect(finding).toMatchObject({ status: 'WARN', result: { verified: false } });
    // Beyan girmeyen öğrenci için GNO kuralı çalışmaz; eksik veri bulgusu yazılır.
    expect(res.body.findings.filter((x: { studentNo: string }) => x.studentNo === ONUR).map((x: { ruleCode: string }) => x.ruleCode)).toContain('VERI-01');

    const blocked = await as(KOORD).patch(`/scan-findings/${finding.id}`, { decision: 'CONFIRMED', reason: 'İlk düşüş, izin kullanıldı' }).expect(409);
    expect(blocked.body.detail).toMatch(/doğrulanmamış/);
    await as(GIZEM).post(`/term-records/${rec.body.id}/verify`).expect(403);
    await as(KOORD).post(`/term-records/${rec.body.id}/verify`).expect(201);
    await as(GIZEM).put(`/enrollments/${gizem}/term-record`, { termId: TERM, mainGano: 3.0 }).expect(409); // doğrulanan beyan değişmez
    await as(KOORD).patch(`/scan-findings/${finding.id}`, { decision: 'CONFIRMED', reason: 'İlk düşüş, izin kullanıldı' }).expect(200);
    expect((await prisma.enrollment.findUniqueOrThrow({ where: { id: gizem } })).ganoStrikes).toBe(1);
  });

  it('izin ve ayrılma: Erasmus döneminde ders kaydı yapılamaz; ÇAP’tan ayrılanın yan dal durumu hesaplanır', async () => {
    const deniz = await enrollmentOf(DENIZ);
    await signAll(DENIZ);
    await signAll('bolum.eem');
    await signAll(HEAD);
    const d = await detail(DENIZ, deniz);
    expect(d.protocol.status).toBe('APPROVED');
    await as(DENIZ).post(`/enrollments/${deniz}/leaves`, { termId: TERM, reason: 'ERASMUS' }).expect(403);
    await as(KOORD).post(`/enrollments/${deniz}/leaves`, { termId: TERM, reason: 'ERASMUS', note: 'Erasmus 2026-27 güz' }).expect(201);
    await as(DENIZ).put(`/enrollments/${deniz}/course-registration`, { termId: TERM, items: [{ protocolCourseId: d.registrationOptions[0].protocolCourseId }] }).expect(409);

    const gizem = await enrollmentOf(GIZEM);
    const w = await as(GIZEM).post(`/enrollments/${gizem}/withdrawal`, { reason: 'Ana dalıma yoğunlaşmak istiyorum' }).expect(201);
    expect(w.body.outcome).toMatchObject({ hasMinorProgram: true, eligibleForCertificate: false, passedPoolEcts: 16 });
    await as(GIZEM).post(`/enrollments/${gizem}/withdrawal`, { reason: 'ikinci kez deniyorum' }).expect(409);
    const list = await as('danisman.eem').get('/main-department/students').expect(200);
    expect(list.body.items.map((x: { studentNo: string }) => x.studentNo)).toEqual(expect.arrayContaining([AYSE, GIZEM]));
    expect(list.body.items.some((x: { studentNo: string }) => x.studentNo === ONUR)).toBe(false);
  });

  it('protokol şablonları ve teklifler: gerçek protokoller yüklü; kurallar şablon kaydında denetlenir', async () => {
    const list = await as(KOORD).get('/protocol-templates').expect(200);
    expect(list.body.map((t: { id: string; ects: number; totalEcts: number; conditions: unknown[] }) => [t.id, t.ects, t.totalEcts, t.conditions.length])).toEqual(
      expect.arrayContaining([
        ['PT-CAP-EEM', 135, 240, 8],
        ['PT-CAP-MAK', 171, 240, 2],
        ['PT-YANDAL', 63, 63, 0],
      ]),
    );
    const eem = list.body.find((t: { id: string }) => t.id === 'PT-CAP-EEM');
    const body = { type: 'CAP', sourceProgramId: 'P-EEM', title: eem.title, commonEcts: eem.commonEcts, items: eem.items, conditions: eem.conditions };
    // Bir ders çıkarılırsa toplam 240 AKTS'nin altına düşer (ÇAP Yön. m.7/2).
    const short = await as(KOORD).put('/protocol-templates/PT-CAP-EEM', { ...body, items: eem.items.slice(1) }).expect(422);
    expect(short.body.results[0].code).toBe('KR-ÇAP-18');
    await as(KOORD).put('/protocol-templates/PT-CAP-EEM', { ...body, items: [...eem.items, { kind: 'COURSE', code: '9999999', name: 'Olmayan Ders', ects: 4, semester: 3 }] }).expect(422);
    // Muafiyet başvurusu bulunan özel şart kaldırılamaz.
    await as(KOORD).put('/protocol-templates/PT-CAP-EEM', { ...body, conditions: eem.conditions.slice(1) }).expect(409);
    await as(KOORD).put('/protocol-templates/PT-CAP-EEM', body).expect(200);
    await as(HEAD).put('/protocol-templates/PT-CAP-EEM', body).expect(403);
    await as(KOORD).post('/protocol-templates', { ...body, sourceProgramId: 'P-MAK' }).expect(409);

    const offering = { termId: TERM, type: 'CAP', quota: 4, sourceProgramIds: ['P-EEM'], opensAt: '2026-09-01T09:00:00+03:00', closesAt: '2026-09-15T17:00:00+03:00' };
    await as(KOORD).post('/offerings', offering).expect(409);
    await as(KOORD).post('/offerings', { ...offering, termId: 'T-2026-BAHAR', closesAt: '2026-08-01T09:00:00+03:00' }).expect(400);
    const created = await as(KOORD).post('/offerings', { ...offering, termId: 'T-2026-BAHAR', opensAt: '2027-01-10T09:00:00+03:00', closesAt: '2027-01-25T17:00:00+03:00' }).expect(201);
    expect(created.body.offering.status).toBe('DRAFT');
    await as(KOORD).put('/year-stats', { year: 2027, baseScore: 398.5, successRankLimit: 300000 }).expect(200);
  });

  it('yönetim: rolleri Bilgisayar Mühendisliği bölüm başkanı atar; denetim kaydı değiştirilemez', async () => {
    const user = { username: 'yeni.danisman', displayName: 'Mekatronik Mühendisliği Danışmanı', email: 'yeni.danisman@personel.test' };
    await as(KOORD).post('/users', user).expect(403);
    await as('bolum.eem').post('/users', user).expect(403);
    await as(HEAD).post('/users', user).expect(201);
    await as(HEAD).post(`/users/${user.username}/assignments`, { role: 'DANISMAN' }).expect(400);
    await as(HEAD).post(`/users/${user.username}/assignments`, { role: 'DANISMAN', programId: 'P-BIL' }).expect(400);
    const a = await as(HEAD).post(`/users/${user.username}/assignments`, { role: 'DANISMAN', programId: 'P-MEK' }).expect(201);
    expect((await as(user.username).get('/me').expect(200)).body.roles).toEqual(['DANISMAN']);
    await as(HEAD).post(`/users/${AYSE}/assignments`, { role: 'KOORDINATOR' }).expect(409); // öğrenci hesabı
    await as(HEAD).del(`/assignments/${a.body.id}`).expect(200);
    const users = await as(KOORD).get('/users').expect(200);
    expect(users.body.canManage).toBe(false);
    const headRole = users.body.staff.find((u: { username: string }) => u.username === HEAD).assignments[0];
    await as(HEAD).del(`/assignments/${headRole.id}`).expect(409);

    const audit = await as(KOORD).get('/audit?action=approval').expect(200);
    expect(audit.body.length).toBeGreaterThan(5);
    await as('bolum.eem').get('/audit').expect(403);
    await expect(prisma.$executeRawUnsafe(`UPDATE "AuditLog" SET actor = 'x'`)).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe(`DELETE FROM "AuditLog"`)).rejects.toThrow();

    const report = await as(HEAD).get('/reports/summary').expect(200);
    expect(report.body.rows.find((r: { type: string }) => r.type === 'CAP')).toMatchObject({ quota: 3, enrolled: 2 });
    const rules = await as(KOORD).get('/rule-sets').expect(200);
    expect(rules.body.map((r: { version: string }) => r.version).sort()).toEqual(['CAP-2026.3', 'YANDAL-2023.3']);
    const tasks = await as(KOORD).get('/me/tasks').expect(200);
    expect(tasks.body.tasks.map((t: { key: string }) => t.key)).toEqual(expect.arrayContaining(['records', 'findings']));
  });
});
