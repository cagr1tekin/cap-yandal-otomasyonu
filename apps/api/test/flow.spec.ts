/**
 * Koordinatörün çerçeve e-postasındaki akış (docs/KARARLAR.md K-18), gerçek PostgreSQL test veritabanında:
 * öğrenci ekleme → belge → ders listesi → onay → dönem dersleri → dönem sonu not + transkript →
 * kural uyarısı → düzeltme / iptal → karar. Sızma testleri security.spec.ts dosyasındadır.
 */
import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from '../src/prisma/prisma.service';
import { bootstrap, HEAD, KOORD, PDF, TERM } from './app';
import type { FakeIdentity } from './fakes';

const AYSE = '253302001';
const BUSRA = '253302009';
const KEREM = '253303008';
const GIZEM = '243302013';
const IREM = '243302016';
const SELIN = '233302020';
const YENI = '263302777';

describe('ÇAP / YDP takip akışı', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let identity: FakeIdentity;
  let as: Awaited<ReturnType<typeof bootstrap>>['as'];
  const card = async (user: string, no: string) => (await as(user).get(`/students/${no}`).expect(200)).body;
  const item = (c: { planItems: { courseCode: string | null; id: string; state: string; status: string; attempts: { id: string; termId: string; status: string; result: string; grade: string | null }[] }[] }, code: string) =>
    c.planItems.find((i) => i.courseCode === code && i.state !== 'CIKARILDI')!;

  beforeAll(async () => {
    ({ app, prisma, identity, as } = await bootstrap());
  });

  afterAll(async () => {
    await app?.close();
  });

  it('koordinatör kabul edilen öğrenciyi ekler; hesap açılır ve şifre bağlantısı gönderilir', async () => {
    const body = { studentNo: YENI, fullName: 'Deneme Öğrenci', schoolEmail: 'yeni.ogrenci@ogrenci.selcuk.test', track: 'CAP', admissionTermId: TERM, mainProgramId: 'P-EEM' };
    await as(AYSE).post('/students', body).expect(403);
    await as(HEAD).post('/students', body).expect(403);
    await as(KOORD).post('/students', { ...body, studentNo: '12' }).expect(400);
    await as(KOORD).post('/students', { ...body, mainProgramId: 'P-BIL' }).expect(422);
    const res = await as(KOORD).post('/students', body).expect(201);
    expect(res.body).toMatchObject({ studentNo: YENI, status: 'ACTIVE', track: 'CAP' });
    expect(identity.accounts.get(YENI)).toMatchObject({ email: 'yeni.ogrenci@ogrenci.selcuk.test' });
    expect(identity.invites).toContain(YENI);
    await as(KOORD).post('/students', body).expect(409);
    // Yeni öğrenci kendi hesabıyla girer ve yalnız kendi kartını görür.
    expect((await as(YENI).get('/me').expect(200)).body).toMatchObject({ role: 'OGRENCI', studentNo: YENI });
    await as(YENI).get(`/students/${AYSE}`).expect(404);
    await as(YENI).get('/students').expect(403);
  });

  it('öğrenci ders listesine yalnız katalogdan ekler; katalogda olmayan ders için talep gönderir', async () => {
    await as(YENI).post(`/students/${YENI}/plan`, { courseCode: 'XYZ9999' }).expect(404);
    await as(YENI).post(`/students/${YENI}/plan`, { courseCode: 'serbest metin' }).expect(400);
    const added = await as(YENI).post(`/students/${YENI}/plan`, { courseCode: '3301156' }).expect(201);
    expect(added.body).toMatchObject({ status: 'PENDING', source: 'STUDENT', name: 'Bilgisayar Mühendisliğine Giriş', ects: 4 });
    await as(YENI).post(`/students/${YENI}/plan`, { courseCode: '3301156' }).expect(409);
    // Koordinatör pasife aldığı dersi kimse listeye ekleyemez.
    await as(KOORD).patch('/courses/3301789', { active: false, reason: 'Bu yıl açılmıyor' }).expect(200);
    await as(YENI).post(`/students/${YENI}/plan`, { courseCode: '3301789' }).expect(409);

    const req = await as(YENI).post(`/students/${YENI}/course-requests`, { code: '3301999', name: 'Kuantum Hesaplama', note: 'Protokolde yeni seçmeli olarak var' }).expect(201);
    await as(KOORD).post(`/course-requests/${req.body.id}/review`, { decision: 'APPROVED', courseCode: '3301999' }).expect(404);
    await as(KOORD).post('/courses', { code: '3301999', name: 'Kuantum Hesaplama', ects: 4, semester: 7, kind: 'TEKNIK_SECMELI' }).expect(201);
    await as(KOORD).post(`/course-requests/${req.body.id}/review`, { decision: 'APPROVED', courseCode: '3301999', addToPlan: true }).expect(201);
    const c = await card(YENI, YENI);
    expect(item(c, '3301999')).toMatchObject({ status: 'APPROVED' });
  });

  it('onay mantığı: onaylanan kayıt kilitlenir; reddedilen silinmez; koordinatör eklerken gerekçe zorunlu', async () => {
    const c = await card(KOORD, YENI);
    const giris = item(c, '3301156');
    await as(HEAD).post(`/reviews/plan/${giris.id}`, { decision: 'APPROVED' }).expect(403);
    await as(KOORD).post(`/reviews/plan/${giris.id}`, { decision: 'APPROVED' }).expect(201);
    await as(KOORD).post(`/reviews/plan/${giris.id}`, { decision: 'APPROVED' }).expect(409);
    await as(YENI).post(`/plan-items/${giris.id}/cancel`, { reason: 'Vazgeçtim bu dersten' }).expect(403);

    const r = await as(YENI).post(`/students/${YENI}/plan`, { courseCode: '3301351' }).expect(201);
    await as(KOORD).post(`/reviews/plan/${r.body.id}`, { decision: 'REJECTED' }).expect(400);
    await as(KOORD).post(`/reviews/plan/${r.body.id}`, { decision: 'REJECTED', note: 'Protokolde yok' }).expect(201);
    expect(await prisma.planItem.findUnique({ where: { id: r.body.id } })).toMatchObject({ status: 'REJECTED', reviewNote: 'Protokolde yok' });

    await as(KOORD).post(`/students/${YENI}/plan`, { courseCode: '3301352' }).expect(422);
    await as(KOORD).post(`/students/${YENI}/plan/template`, { templateId: 'PT-CAP-EEM', reason: 'EEM → Bilgisayar protokolü' }).expect(201);
    const after = await card(KOORD, YENI);
    expect(after.totals.plannedEcts).toBeGreaterThanOrEqual(135);
    expect(after.student.commonEcts).toBe(105);
    expect(after.live.plan.find((x: { code: string }) => x.code === 'KR-ÇAP-18').status).toBe('PASS');
  });

  it('dönem dersleri: öğrenci içinde bulunulan dönemi girer, seçmeli yere katalogdan ders seçer', async () => {
    const c = await card(YENI, YENI);
    const giris = item(c, '3301156');
    await as(YENI).post(`/students/${YENI}/attempts`, { planItemId: giris.id, termId: 'T-2025-GUZ' }).expect(409);
    const a = await as(YENI).post(`/students/${YENI}/attempts`, { planItemId: giris.id, termId: TERM }).expect(201);
    expect(a.body).toMatchObject({ status: 'PENDING', courseCode: '3301156' });
    await as(YENI).post(`/students/${YENI}/attempts`, { planItemId: giris.id, termId: TERM }).expect(409);

    const slot = c.planItems.find((i: { kind: string; semester: number }) => i.kind === 'ELECTIVE_SLOT' && i.semester === 5);
    await as(YENI).post(`/students/${YENI}/attempts`, { planItemId: slot.id, termId: TERM }).expect(422);
    await as(YENI).post(`/students/${YENI}/attempts`, { planItemId: slot.id, termId: TERM, courseCode: '3301661' }).expect(422);
    await as(YENI).post(`/students/${YENI}/attempts`, { planItemId: slot.id, termId: TERM, courseCode: '3301354' }).expect(422);
    const s5 = await as(YENI).post(`/students/${YENI}/attempts`, { planItemId: slot.id, termId: TERM, courseCode: '3301562' }).expect(201);

    await as(KOORD).post(`/reviews/attempt/${a.body.id}`, { decision: 'APPROVED' }).expect(201);
    await as(KOORD).post(`/reviews/attempt/${s5.body.id}`, { decision: 'APPROVED' }).expect(201);
    const after = await card(YENI, YENI);
    expect(item(after, '3301156').state).toBe('ALINDI');
  });

  it('dönem sonu: not belgesi yüklenmeden notlar onaya gönderilemez; koordinatör karşılaştırıp onaylar', async () => {
    const c = await card(YENI, YENI);
    const ids = c.gradeable.map((g: { id: string }) => g.id);
    expect(ids).toHaveLength(2);
    const otherDoc = await as(YENI).upload(YENI, { kind: 'ANADAL_TRANSKRIPT', termId: TERM }, PDF).expect(201);
    await as(YENI).post(`/students/${YENI}/grade-submissions`, { termId: TERM, transcriptId: otherDoc.body.id, grades: [{ attemptId: ids[0], grade: 'BB' }] }).expect(422);
    await as(YENI).upload(YENI, { kind: 'CAP_TRANSKRIPT' }, PDF).expect(422);
    const tr = await as(YENI).upload(YENI, { kind: 'CAP_TRANSKRIPT', termId: TERM }, PDF, 'not-belgesi.pdf').expect(201);
    const sub = await as(YENI).post(`/students/${YENI}/grade-submissions`, { termId: TERM, transcriptId: tr.body.id, grades: [{ attemptId: ids[0], grade: 'DC' }, { attemptId: ids[1], grade: 'FF' }] }).expect(201);
    expect(sub.body.status).toBe('PENDING');
    await as(YENI).post(`/students/${YENI}/grade-submissions`, { termId: TERM, transcriptId: tr.body.id, grades: [{ attemptId: ids[0], grade: 'AA' }] }).expect(409);
    // Onaylanana kadar kural hesabına girmez.
    expect(item(await card(YENI, YENI), '3301156').state).toBe('ALINDI');

    await as(KOORD).post(`/reviews/grades/${sub.body.id}`, { decision: 'APPROVED', conditionalPass: [ids[0]] }).expect(201);
    const after = await card(YENI, YENI);
    expect(item(after, '3301156')).toMatchObject({ state: 'GECTI' });
    expect(after.totals.completedEcts).toBe(4);
    expect((await prisma.document.findUnique({ where: { id: tr.body.id } }))?.status).toBe('APPROVED');
    // Kalan seçmeli dersi sonraki dönem yeniden almak ayrı bir denemedir.
    const slot = after.planItems.find((i: { kind: string; semester: number; attempts: unknown[] }) => i.kind === 'ELECTIVE_SLOT' && i.semester === 5 && i.attempts.length);
    expect(slot.state).toBe('KALDI');
  });

  it('düzeltme yalnız koordinatörde ve kayıt altında; iptal edilen kayıt silinmez', async () => {
    const c = await card(KOORD, GIZEM);
    const nyp = item(c, '3301351');
    expect(nyp.attempts.map((a) => [a.termId, a.result])).toEqual([
      ['T-2025-GUZ', 'FAILED'],
      [TERM, 'TAKEN'],
    ]);
    const first = nyp.attempts[0];
    await as(GIZEM).patch(`/attempts/${first.id}`, { grade: 'CC', reason: 'Not yanlış girilmiş' }).expect(403);
    await as(KOORD).patch(`/attempts/${first.id}`, { grade: 'DC', passed: false }).expect(400);
    await as(KOORD).patch(`/attempts/${first.id}`, { grade: 'FF', termId: 'T-2025-GUZ', reason: 'Transkriptle karşılaştırıldı, değişiklik yok' }).expect(200);
    const log = await prisma.auditLog.findFirst({ where: { action: 'ATTEMPT_CORRECT', entityId: first.id } });
    expect(log).toMatchObject({ actor: KOORD, studentNo: GIZEM, reason: 'Transkriptle karşılaştırıldı, değişiklik yok' });

    const current = nyp.attempts[1];
    await as(KOORD).post(`/attempts/${current.id}/cancel`, { reason: 'Ders bu dönem açılmadı' }).expect(201);
    expect((await prisma.courseAttempt.findUnique({ where: { id: current.id } }))?.status).toBe('CANCELLED');
    await expect(prisma.courseAttempt.delete({ where: { id: current.id } })).rejects.toThrow();
  });

  it('ders listesi değişikliği gerekçe ve tarihle kaydedilir; geçilmiş ders etkilenmez', async () => {
    const c = await card(KOORD, GIZEM);
    const passed = item(c, '3301156');
    await as(KOORD).post(`/plan-items/${passed.id}/remove`, { reason: 'Müfredat değişti' }).expect(409);
    const mobil = item(c, '3301456');
    await as(KOORD).post(`/plan-items/${mobil.id}/remove`, { reason: 'Kısa' }).expect(400);
    await as(KOORD).post(`/plan-items/${mobil.id}/remove`, { reason: 'Bölüm kurulu kararıyla müfredattan çıktı' }).expect(201);
    const row = await prisma.planItem.findUnique({ where: { id: mobil.id } });
    expect(row).toMatchObject({ removedBy: KOORD, removeReason: 'Bölüm kurulu kararıyla müfredattan çıktı' });
    expect(row?.removedAt).toBeInstanceOf(Date);
    // Katalogda ders adı değişse de öğrencinin listesindeki ve notlarındaki bilgi değişmez.
    await as(KOORD).patch('/courses/3301156', { name: 'Bilgisayar Mühendisliğine Giriş (yeni ad)', reason: 'Bologna güncellemesi' }).expect(200);
    const after = await card(KOORD, GIZEM);
    expect(item(after, '3301156')).toMatchObject({ name: 'Bilgisayar Mühendisliğine Giriş', state: 'GECTI' });
    expect(after.planItems.find((i: { id: string }) => i.id === mobil.id).state).toBe('CIKARILDI');

    const veri = item(after, '3301354');
    await as(KOORD).post(`/plan-items/${veri.id}/exempt`, { reason: 'Özel şart 1: 3302458 Veri Yapıları (BB)', conditionNo: 1 }).expect(201);
    expect(item(await card(GIZEM, GIZEM), '3301354').state).toBe('MUAF');
  });

  it('mevcut öğrenci: geçmiş dönem dersleri ve notları onay kilidine takılmadan girilir', async () => {
    const c = await card(KOORD, IREM);
    expect(c.live.worst).toBe('FAIL');
    const giris = item(c, '3301156');
    const b = await as(KOORD).post(`/students/${IREM}/attempts/backfill`, { planItemId: giris.id, termId: 'T-2025-GUZ', grade: 'CB' }).expect(201);
    expect(b.body).toMatchObject({ status: 'APPROVED', source: 'BACKFILL', result: 'PASSED' });
    await as(IREM).post(`/students/${IREM}/attempts/backfill`, { planItemId: giris.id, termId: 'T-2025-BAHAR', grade: 'CB' }).expect(403);
    const after = await card(KOORD, IREM);
    expect(after.live.termEnd.find((r: { code: string }) => r.code === 'KR-ÇAP-10').status).toBe('WARN');
  });

  it('GANO yalnız koordinatörce kaynağıyla girilir; kural uyarısı öğrenciye ve koordinatöre gider', async () => {
    await as(GIZEM).post(`/students/${GIZEM}/gano`, { termId: TERM, gano: 3.5, source: 'TRANSKRIPT' }).expect(403);
    await as(KOORD).post(`/students/${GIZEM}/gano`, { termId: TERM, gano: 4.5, source: 'TRANSKRIPT' }).expect(400);
    await as(KOORD).post(`/students/${GIZEM}/gano`, { termId: TERM, gano: 2.6, source: 'OGRENCI_ISLERI', sourceNote: 'Dönem sonu yazısı' }).expect(201);
    await as(KOORD).post(`/students/${GIZEM}/gano`, { termId: TERM, gano: 2.7, source: 'TRANSKRIPT' }).expect(409);
    const c = await card(GIZEM, GIZEM);
    expect(c.live.termEnd.find((r: { code: string }) => r.code === 'KR-ÇAP-11').status).toBe('WARN');
    expect(c.student.ganoRecords[0]).toMatchObject({ gano: 2.6, source: 'OGRENCI_ISLERI', sourceNote: null });
    expect(await prisma.notification.count({ where: { username: GIZEM, title: 'Yönerge uyarısı' } })).toBeGreaterThan(0);
  });

  it('kural değerleri sürümle değişir; geçmiş kontroller yeniden yazılmaz', async () => {
    const old = await prisma.ruleCheck.findFirstOrThrow({ where: { studentNo: GIZEM }, orderBy: { createdAt: 'desc' }, include: { ruleSet: true } });
    const sets = (await as(KOORD).get('/rule-sets').expect(200)).body as { id: string; type: string; status: string }[];
    await as(HEAD).post('/rule-sets', { type: 'CAP', version: 'CAP-2027.1', effectiveFrom: '2026-01-01', paramOverrides: {} }).expect(403);
    const draft = await as(KOORD).post('/rule-sets', { type: 'CAP', version: 'CAP-2027.1', effectiveFrom: '2026-01-01', paramOverrides: { 'KR-ÇAP-11': { threshold: 2.5, floor: 2.3 } }, note: 'Senato 2027-x (deneme)' }).expect(201);
    const dry = (await as(KOORD).get(`/rule-sets/${draft.body.id}/dry-run`).expect(200)).body;
    // Onur'un ana dal GNO'su 2,60: 2,72 eşiğinde uyarı, 2,50 eşiğinde sorun yok.
    expect(dry.rows.find((r: { studentNo: string }) => r.studentNo === '243303014')).toMatchObject({ before: 'WARN', after: 'OK', changed: true });
    await as(KOORD).post(`/rule-sets/${draft.body.id}/activate`).expect(201);
    await as(KOORD).post('/checks/run-all').expect(201);
    expect((await prisma.ruleCheck.findUniqueOrThrow({ where: { id: old.id } })).ruleSetId).toBe(old.ruleSetId);
    const latest = await prisma.ruleCheck.findFirstOrThrow({ where: { studentNo: GIZEM }, orderBy: { createdAt: 'desc' }, include: { ruleSet: true } });
    expect(latest.ruleSet.version).toBe('CAP-2027.1');
    expect(sets.find((s) => s.type === 'CAP' && s.status === 'ACTIVE')).toBeTruthy();
    expect((await prisma.ruleSet.findFirstOrThrow({ where: { version: 'CAP-2026.4' } })).status).toBe('RETIRED');
  });

  it('belgeler: sürüm zinciri, belge isteği, öğrenci belge silemez', async () => {
    const req = await as(KOORD).post(`/students/${AYSE}/document-requests`, { kind: 'DIGER', message: 'Ana dal ders planınızı yükleyin' }).expect(201);
    const protokol = (await prisma.document.findFirstOrThrow({ where: { studentNo: AYSE, kind: 'PROTOKOL' } })).id;
    await as(KOORD).post(`/reviews/document/${protokol}`, { decision: 'REJECTED', note: 'Ana dal bölüm başkanı imzası eksik' }).expect(201);
    const v2 = await as(AYSE).upload(AYSE, { kind: 'PROTOKOL', replacesId: protokol }, PDF, 'protokol-imzali.pdf').expect(201);
    await as(AYSE).upload(AYSE, { kind: 'PROTOKOL', replacesId: protokol }, PDF).expect(409);
    expect(await prisma.document.findUnique({ where: { id: protokol } })).toMatchObject({ status: 'REJECTED' });
    expect(v2.body).toMatchObject({ previousId: protokol, status: 'PENDING' });
    await as(AYSE).upload(AYSE, { kind: 'YK_KARARI' }, PDF).expect(422);
    const answer = await as(AYSE).upload(AYSE, { kind: 'DIGER', requestId: req.body.id }, PDF).expect(201);
    expect((await prisma.documentRequest.findUnique({ where: { id: req.body.id } }))?.status).toBe('UPLOADED');
    await as(KOORD).post(`/reviews/document/${answer.body.id}`, { decision: 'APPROVED' }).expect(201);
    expect((await prisma.documentRequest.findUnique({ where: { id: req.body.id } }))?.status).toBe('APPROVED');
    await as(AYSE).del(`/documents/${answer.body.id}`).expect(404);
    await as(AYSE).post(`/documents/${answer.body.id}/cancel`, { reason: 'Yanlış yükledim' }).expect(403);
    await expect(prisma.document.delete({ where: { id: answer.body.id } })).rejects.toThrow();
    const list = (await as(AYSE).get(`/students/${AYSE}/documents`).expect(200)).body;
    expect(list.documents.map((d: { id: string }) => d.id)).toEqual(expect.arrayContaining([protokol, v2.body.id]));
  });

  it('mesajlaşma: kalıcı, ekli, karşı taraf haberdar; öğrenci yalnız kendi yazışmasını görür', async () => {
    await as(KEREM).post(`/students/${KEREM}/messages`, { body: 'Hocam ders listem ne zaman onaylanır?' }).expect(201);
    expect(await prisma.notification.count({ where: { username: KOORD, title: { contains: 'Yeni mesaj' } } })).toBeGreaterThan(0);
    const thread = (await as(KOORD).get(`/students/${KEREM}/messages`).expect(200)).body;
    expect(thread[0]).toMatchObject({ body: 'Hocam ders listem ne zaman onaylanır?', readAt: expect.any(String) });
    await as(BUSRA).get(`/students/${KEREM}/messages`).expect(404);
    await as(BUSRA).post(`/students/${KEREM}/messages`, { body: 'araya girme denemesi' }).expect(404);
    await as(HEAD).post(`/students/${KEREM}/messages`, { body: 'izleyici' }).expect(403);
    await expect(prisma.message.update({ where: { id: thread[0].id }, data: { body: 'değiştirildi' } })).rejects.toThrow();
    await expect(prisma.message.delete({ where: { id: thread[0].id } })).rejects.toThrow();
    const inbox = (await as(HEAD).get('/messages/inbox').expect(200)).body;
    expect(inbox.find((t: { studentNo: string }) => t.studentNo === KEREM)).toBeTruthy();
  });

  it('koordinatör notları öğrenciye kapalı; bölüm başkanı görür ama değiştiremez', async () => {
    const n = await as(KOORD).post(`/students/${KEREM}/notes`, { body: 'Danışmanıyla görüşüldü, liste düzeltilecek.' }).expect(201);
    await as(KEREM).get(`/students/${KEREM}/notes`).expect(404);
    expect((await as(HEAD).get(`/students/${KEREM}/notes`).expect(200)).body).toHaveLength(1);
    await as(HEAD).post(`/notes/${n.body.id}/cancel`, { reason: 'deneme amaçlı' }).expect(403);
    await as(KOORD).post(`/notes/${n.body.id}/cancel`, { reason: 'Yanlış öğrenciye yazıldı' }).expect(201);
    expect((await prisma.studentNote.findUnique({ where: { id: n.body.id } }))?.cancelReason).toBe('Yanlış öğrenciye yazıldı');
  });

  it('karar koordinatördedir: sertifika, yanlış türde karar reddi, kararın iptali', async () => {
    const c = await card(KOORD, SELIN);
    expect(c.live.graduationReady).toBe(true);
    await as(KOORD).post(`/students/${SELIN}/decisions`, { type: 'MEZUNIYET', reason: 'Diploma kararı' }).expect(422);
    const d = await as(KOORD).post(`/students/${SELIN}/decisions`, { type: 'SERTIFIKA', reason: 'Yan dal listesini 2,00 üzeri ortalamayla tamamladı', reference: 'FYK 2026/50-4' }).expect(201);
    expect(d.body).toMatchObject({ previousStatus: 'ACTIVE', newStatus: 'CERTIFIED', ruleCheckId: expect.any(String) });
    expect((await card(SELIN, SELIN)).student.status).toBe('CERTIFIED');
    await as(KOORD).post(`/decisions/${d.body.id}/cancel`, { reason: 'Karar sayısı yanlış girildi' }).expect(201);
    expect((await card(KOORD, SELIN)).student.status).toBe('ACTIVE');
  });

  it('dışarıdan aktarım: deneme yazmaz; onaylanınca elle girişle aynı yoldan geçer', async () => {
    const rows = [
      { studentNo: KEREM, courseCode: '3301455', termId: 'T-2025-BAHAR', grade: 'BB' },
      { studentNo: '999999999', courseCode: '3301455', termId: 'T-2025-BAHAR', grade: 'BB' },
      { studentNo: KEREM, courseCode: '3301455', termId: 'T-1900-GUZ', grade: 'BB' },
    ];
    const dry = (await as(KOORD).post('/imports', { kind: 'ATTEMPTS', rows }).expect(201)).body;
    expect(dry.results.map((r: { action: string }) => r.action)).toEqual(['EKLE', 'HATA', 'HATA']);
    expect(await prisma.courseAttempt.count({ where: { studentNo: KEREM } })).toBe(0);
    const done = (await as(KOORD).post('/imports', { kind: 'ATTEMPTS', rows: rows.slice(0, 1), commit: true }).expect(201)).body;
    expect(done.ok).toBe(1);
    expect(await prisma.courseAttempt.findFirst({ where: { studentNo: KEREM } })).toMatchObject({ source: 'IMPORT', grade: 'BB', status: 'APPROVED' });
    const courses = await as(KOORD).post('/imports', { kind: 'COURSES', rows: [{ code: '3301998', name: 'Yeni Ders', ects: '4', semester: '6', kind: 'TEKNIK_SECMELI' }], commit: true }).expect(201);
    expect(courses.body.ok).toBe(1);
  });

  it('işlem kaydı: bölüm başkanı görür; kayıt değiştirilemez ve silinemez', async () => {
    const rows = (await as(HEAD).get(`/audit?studentNo=${GIZEM}`).expect(200)).body;
    expect(rows.some((r: { action: string }) => r.action === 'ATTEMPT_CORRECT')).toBe(true);
    await as(GIZEM).get('/audit').expect(403);
    await expect(prisma.$executeRawUnsafe(`UPDATE "AuditLog" SET actor = 'x'`)).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe(`DELETE FROM "AuditLog"`)).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe(`DELETE FROM "Student"`)).rejects.toThrow();
    const history = (await as(HEAD).get(`/students/${GIZEM}/history`).expect(200)).body;
    expect(history.length).toBeGreaterThan(3);
    await as(GIZEM).get(`/students/${GIZEM}/history`).expect(404);
  });

  it('hesaplar: koordinatör personel açar, pasife alır; son koordinatör korunur', async () => {
    const u = await as(KOORD).post('/users', { username: 'bolum.yardimci', displayName: 'Bölüm Başkan Yardımcısı', email: 'bolum.yardimci@personel.test', role: 'BOLUM_BASKANI' }).expect(201);
    expect(identity.invites).toContain('bolum.yardimci');
    expect((await as('bolum.yardimci').get('/me').expect(200)).body.role).toBe('BOLUM_BASKANI');
    await as(KOORD).post(`/users/${u.body.id}/deactivate`, { reason: 'Görevi sona erdi' }).expect(201);
    await as('bolum.yardimci').get('/me').expect(403);
    const me = (await as(KOORD).get('/me').expect(200)).body;
    await as(KOORD).post(`/users/${me.id}/deactivate`, { reason: 'Kendimi pasife alıyorum' }).expect(409);
    const tasks = (await as(KOORD).get('/me/tasks').expect(200)).body.tasks.map((t: { key: string }) => t.key);
    expect(tasks).toEqual(expect.arrayContaining(['reviews', 'fail']));
  });
});
