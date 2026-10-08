'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { act, api, ApiError, type ActionState } from '@/lib/api';
import { fromLocalInput } from '@/lib/format';
import type { Course } from '@/lib/types';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const date = (f: FormData, k: string) => (s(f, k) ? fromLocalInput(s(f, k)) : undefined);

const fail = (e: unknown): ActionState => {
  if (e instanceof ApiError) return { ok: false, message: e.problem.detail ?? e.problem.title, problem: e.problem };
  throw e;
};

// ---------------- Öğrenci: bilgiler ve belgeler ----------------

export async function saveProfileAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () =>
      api('/me/profile', {
        method: 'PUT',
        json: {
          studentNo: s(f, 'studentNo'),
          fullName: s(f, 'fullName'),
          email: s(f, 'email'),
          phone: s(f, 'phone') || undefined,
          programId: s(f, 'programId'),
          entryYear: s(f, 'entryYear'),
          semesterNo: s(f, 'semesterNo'),
          gano: s(f, 'gano').replace(',', '.'),
          completedAllCourses: s(f, 'completedAllCourses') === 'true',
          classRank: s(f, 'classRank'),
          classSize: s(f, 'classSize'),
          entryScore: s(f, 'entryScore').replace(',', '.'),
          successRank: s(f, 'successRank'),
          advisorUsername: s(f, 'advisorUsername') || undefined,
        },
      }),
    'Bilgileriniz kaydedildi.',
  );
  revalidatePath('/', 'layout');
  return r;
}

export async function uploadDocumentAction(_: ActionState, f: FormData): Promise<ActionState> {
  const file = f.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Yüklenecek dosyayı seçin.' };
  if (file.size > 5 * 1024 * 1024) return { ok: false, message: 'Dosya 5 MB sınırını aşıyor.' };
  const body = new FormData();
  body.set('kind', s(f, 'kind'));
  body.set('file', file, file.name);
  const r = await act(() => api('/me/documents', { method: 'POST', body }), 'Belge yüklendi.');
  revalidatePath('/ogrenci', 'layout');
  return r;
}

export async function deleteDocumentAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/me/documents/${s(f, 'id')}`, { method: 'DELETE' }), 'Belge silindi.');
  revalidatePath('/ogrenci', 'layout');
  return r;
}

// ---------------- Başvuru ----------------

export async function applyAction(_: ActionState, f: FormData): Promise<ActionState> {
  let id: string;
  try {
    const res = await api<{ application: { id: string } }>('/applications', { method: 'POST', json: { offeringId: s(f, 'offeringId'), declaration: s(f, 'declaration') === 'on' } });
    id = res.application.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath('/', 'layout');
  redirect(`/ogrenci/basvuru/${id}?gonderildi=1`);
}

export async function withdrawApplicationAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/applications/${s(f, 'id')}/withdraw`, { method: 'POST', json: { reason: s(f, 'reason') } }), 'Başvuru geri çekildi.');
  revalidatePath('/', 'layout');
  return r;
}

/** Kesin kayıt: kabul edilen öğrenci kaydını kendisi onaylar. */
export async function acceptAction(_: ActionState, f: FormData): Promise<ActionState> {
  let id: string;
  try {
    id = (await api<{ id: string }>(`/applications/${s(f, 'id')}/accept`, { method: 'POST' })).id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath('/', 'layout');
  redirect(`/kayitlar/${id}?kayit=1`);
}

export async function verifyAction(_: ActionState, f: FormData): Promise<ActionState> {
  const status = s(f, 'status');
  const r = await act(
    () => api(`/applications/${s(f, 'id')}/verify`, { method: 'POST', json: { status, note: s(f, 'note') || undefined } }),
    status === 'VERIFIED' ? 'Beyan doğrulandı; başvuru sıralamaya alınacak.' : 'Uyuşmazlık işlendi; başvuru değerlendirme dışı kaldı.',
  );
  revalidatePath('/koordinator', 'layout');
  return r;
}

// ---------------- Koordinatör: dönem teklifi ve takvim ----------------

function offeringBody(f: FormData) {
  return {
    quota: Number(s(f, 'quota')),
    sourceProgramIds: f.getAll('sourceProgramIds').map(String),
    firstYearIntake: s(f, 'firstYearIntake') ? Number(s(f, 'firstYearIntake')) : null,
    quotaJustification: s(f, 'quotaJustification') || undefined,
    opensAt: date(f, 'opensAt'),
    closesAt: date(f, 'closesAt'),
    announceAt: date(f, 'announceAt'),
    registrationDeadline: date(f, 'registrationDeadline'),
    waitlistDeadline: date(f, 'waitlistDeadline'),
  };
}

type Warned = { warnings: { code: string; message: string }[] };
const warned = (res: Warned, ok: string): ActionState =>
  res.warnings.length ? { ok: true, message: `${ok} Uyarı var.`, problem: { status: 200, title: '', warnings: res.warnings } } : { ok: true, message: ok };

export async function createOfferingAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const res = await api<Warned>('/offerings', { method: 'POST', json: { termId: s(f, 'termId'), type: s(f, 'type'), ...offeringBody(f) } });
    revalidatePath('/koordinator/donem');
    return warned(res, 'Teklif taslak olarak oluşturuldu; ilan etmek için yayımlayın.');
  } catch (e) {
    return fail(e);
  }
}

export async function updateOfferingAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const status = s(f, 'status');
    // Kilitlenen teklifte kontenjan ve kaynak bölümler formda yer almaz; yalnız takvim güncellenir.
    const { quota, sourceProgramIds, ...dates } = offeringBody(f);
    const body = s(f, 'locked') === '1' ? dates : { quota, sourceProgramIds, ...dates };
    const res = await api<Warned>(`/offerings/${s(f, 'id')}`, { method: 'PATCH', json: { ...body, ...(status ? { status } : {}) } });
    revalidatePath('/', 'layout');
    return warned(res, 'Teklif güncellendi.');
  } catch (e) {
    return fail(e);
  }
}

export async function offeringStatusAction(_: ActionState, f: FormData): Promise<ActionState> {
  const status = s(f, 'status');
  const r = await act(() => api(`/offerings/${s(f, 'id')}`, { method: 'PATCH', json: { status } }), status === 'PUBLISHED' ? 'Teklif yayımlandı.' : 'Teklif durumu güncellendi.');
  revalidatePath('/', 'layout');
  return r;
}

export async function closeNowAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/offerings/${s(f, 'id')}/close-now`, { method: 'POST' }), 'Başvuru dönemi kapatıldı.');
  revalidatePath('/', 'layout');
  return r;
}

export async function yearStatAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () => api('/year-stats', { method: 'PUT', json: { year: s(f, 'year'), baseScore: s(f, 'baseScore').replace(',', '.'), successRankLimit: s(f, 'successRankLimit') } }),
    'Taban puan kaydedildi.',
  );
  revalidatePath('/koordinator/donem');
  return r;
}

// ---------------- Koordinatör: değerlendirme ----------------

export async function overrideAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/rankings/${s(f, 'applicationId')}`, { method: 'PATCH', json: { proposal: s(f, 'proposal'), reason: s(f, 'reason') } }), 'Öneri gerekçesiyle değiştirildi.');
  revalidatePath('/koordinator/degerlendirme', 'layout');
  return r;
}

export async function lockAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/offerings/${s(f, 'offeringId')}/ranking/lock`, { method: 'POST' }), 'Komisyon önerisi kilitlendi.');
  revalidatePath('/koordinator/degerlendirme', 'layout');
  return r;
}

export async function decisionAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () => api(`/offerings/${s(f, 'offeringId')}/decision`, { method: 'POST', json: { decisionDate: s(f, 'decisionDate'), decisionNo: s(f, 'decisionNo') } }),
    'Fakülte yönetim kurulu kararı kaydedildi.',
  );
  revalidatePath('/koordinator/degerlendirme', 'layout');
  return r;
}

export async function publishAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/offerings/${s(f, 'offeringId')}/publish`, { method: 'POST' }), 'Sonuçlar yayımlandı; öğrencilere bildirim gönderildi.');
  revalidatePath('/koordinator/degerlendirme', 'layout');
  return r;
}

export async function closeRegistrationAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const res = await api<{ dropped: number; promoted: string[]; closed: boolean }>(`/offerings/${s(f, 'offeringId')}/close-registration`, { method: 'POST' });
    revalidatePath('/koordinator/degerlendirme', 'layout');
    return {
      ok: true,
      message: `${res.dropped} öğrenci kayıt yaptırmadı, ${res.promoted.length} yedek asile çağrıldı. ${res.closed ? 'Kayıt dönemi kapandı.' : 'Yedeklerin kaydı için dönem açık; bittiğinde yeniden kapatın.'}`,
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------- Koordinatör: protokol şablonları ----------------

export async function saveTemplateAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'id');
  let saved: { id: string };
  try {
    const catalog = await api<Course[]>('/courses');
    const picked = f.getAll('course').map(String);
    const items: { kind: string; code: string | null; name: string; ects: number; semester: number }[] = [];
    // Kâğıt protokoldeki sıra: yarıyıl yarıyıl dersler, ardından o yarıyılın teknik seçmeli ders yerleri.
    for (let semester = 1; semester <= 8; semester++) {
      for (const c of catalog.filter((x) => x.semester === semester && picked.includes(x.code))) items.push({ kind: 'COURSE', code: c.code, name: c.name, ects: c.ects, semester });
      const slots = Number(s(f, `slots:${semester}`) || 0);
      for (let i = 0; i < slots; i++) items.push({ kind: 'ELECTIVE_SLOT', code: null, name: `${semester}. Yarıyıl Teknik Seçmeli Ders`, ects: 4, semester });
    }
    const conditions = [];
    for (let i = 0; f.has(`cond:no:${i}`); i++) {
      if (!s(f, `cond:src:${i}`) && !s(f, `cond:target:${i}`)) continue;
      conditions.push({ no: Number(s(f, `cond:no:${i}`)), sourceCourseCode: s(f, `cond:src:${i}`), sourceCourseName: s(f, `cond:srcName:${i}`), targetCourseCode: s(f, `cond:target:${i}`), note: s(f, `cond:note:${i}`) || undefined });
    }
    const body = { type: s(f, 'type'), sourceProgramId: s(f, 'sourceProgramId') || null, title: s(f, 'title'), commonEcts: Number(s(f, 'commonEcts') || 0), items, conditions };
    saved = await api<{ id: string }>(id ? `/protocol-templates/${id}` : '/protocol-templates', { method: id ? 'PUT' : 'POST', json: body });
  } catch (e) {
    return fail(e);
  }
  revalidatePath('/koordinator/protokoller', 'layout');
  if (!id) redirect(`/koordinator/protokoller/${saved.id}`);
  return { ok: true, message: 'Protokol şablonu kaydedildi.' };
}

// ---------------- Kayıt: protokol, ders kaydı, notlar, muafiyet ----------------

const enrollmentPath = (id: string) => `/kayitlar/${id}`;

export async function createProtocolAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const itemIds = f.getAll('item').map(String);
  const r = await act(() => api(`/enrollments/${id}/protocol`, { method: 'PUT', json: itemIds.length ? { itemIds } : {} }), 'Protokol şablondan üretildi; inceleyip imzaya gönderin.');
  revalidatePath(enrollmentPath(id));
  return r;
}

export async function submitProtocolAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(() => api(`/enrollments/${id}/protocol/submit`, { method: 'POST' }), 'Protokol imzaya gönderildi.');
  revalidatePath('/', 'layout');
  return r;
}

export async function saveCourseRegAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const items: { protocolCourseId: string; courseCode?: string }[] = f.getAll('item').map((v) => ({ protocolCourseId: String(v) }));
  for (const [key, value] of f.entries()) {
    if (key.startsWith('slot:') && value) items.push({ protocolCourseId: key.slice(5), courseCode: String(value) });
  }
  if (!items.length) return { ok: false, message: 'En az bir ders seçin.' };
  const r = await act(() => api(`/enrollments/${id}/course-registration`, { method: 'PUT', json: { termId: s(f, 'termId'), items } }), 'Ders kayıt formu kaydedildi.');
  revalidatePath(enrollmentPath(id));
  return r;
}

export async function submitCourseRegAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(() => api(`/enrollments/${id}/course-registration/submit`, { method: 'POST', json: { termId: s(f, 'termId') } }), 'Ders kayıt formu imzaya gönderildi.');
  revalidatePath('/', 'layout');
  return r;
}

export async function gradesAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const grades: { itemId: string; grade: string; passed: boolean }[] = [];
  for (const [key, value] of f.entries()) {
    if (!key.startsWith('grade:') || !value) continue;
    const itemId = key.slice(6);
    grades.push({ itemId, grade: String(value), passed: f.get(`passed:${itemId}`) === 'on' });
  }
  if (!grades.length) return { ok: false, message: 'En az bir dersin notunu seçin.' };
  const r = await act(() => api(`/enrollments/${id}/grades`, { method: 'PUT', json: { grades } }), `${grades.length} dersin notu işlendi.`);
  revalidatePath(enrollmentPath(id));
  return r;
}

export async function exemptionAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(
    () => api(`/enrollments/${id}/exemptions`, { method: 'POST', json: { conditionId: s(f, 'conditionId'), sourceGrade: s(f, 'sourceGrade'), sourceTerm: s(f, 'sourceTerm') } }),
    'Muafiyet formu imzaya gönderildi.',
  );
  revalidatePath('/', 'layout');
  return r;
}

export async function termRecordAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(
    () => api(`/enrollments/${id}/term-record`, { method: 'PUT', json: { termId: s(f, 'termId'), mainGano: s(f, 'mainGano').replace(',', '.'), mainFrozen: f.get('mainFrozen') === 'on' } }),
    'Dönem beyanı kaydedildi.',
  );
  revalidatePath('/', 'layout');
  return r;
}

export async function verifyTermRecordAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/term-records/${s(f, 'id')}/verify`, { method: 'POST' }), 'Dönem beyanı doğrulandı.');
  revalidatePath('/', 'layout');
  return r;
}

export async function leaveAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(() => api(`/enrollments/${id}/leaves`, { method: 'POST', json: { termId: s(f, 'termId'), reason: s(f, 'reason'), note: s(f, 'note') || undefined } }), 'Dönem izni kaydedildi.');
  revalidatePath(enrollmentPath(id));
  return r;
}

export async function withdrawEnrollmentAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(() => api(`/enrollments/${id}/withdrawal`, { method: 'POST', json: { reason: s(f, 'reason') } }), 'Programdan ayrılma işlendi.');
  revalidatePath('/', 'layout');
  return r;
}

export async function advisorAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(() => api(`/enrollments/${id}/advisor`, { method: 'PUT', json: { username: s(f, 'username') || null } }), 'Ana dal danışmanı güncellendi.');
  revalidatePath(enrollmentPath(id));
  return r;
}

export async function completeAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(() => api(`/enrollments/${id}/complete`, { method: 'POST', json: { mainGano: s(f, 'mainGano').replace(',', '.') } }), 'Mezuniyet koşulları sağlandı; kayıt tamamlandı.');
  revalidatePath('/', 'layout');
  return r;
}

// ---------------- İmzalar ----------------

export async function decideApprovalAction(_: ActionState, f: FormData): Promise<ActionState> {
  const decision = s(f, 'decision');
  const r = await act(
    () => api(`/approvals/${s(f, 'approvalId')}`, { method: 'POST', json: { decision, comment: s(f, 'comment') || undefined } }),
    decision === 'APPROVED' ? 'İmzalandı.' : 'Reddedildi; formu hazırlayana bildirildi.',
  );
  revalidatePath('/', 'layout');
  return r;
}

// ---------------- Taramalar ----------------

export async function startScanAction(_: ActionState, f: FormData): Promise<ActionState> {
  let id: string;
  try {
    id = (await api<{ id: string }>('/scans', { method: 'POST', json: { termId: s(f, 'termId') } })).id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath('/koordinator/taramalar');
  redirect(`/koordinator/taramalar/${id}`);
}

export async function findingAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () => api(`/scan-findings/${s(f, 'findingId')}`, { method: 'PATCH', json: { decision: s(f, 'decision'), reason: s(f, 'reason') } }),
    s(f, 'decision') === 'CONFIRMED' ? 'Bulgu onaylandı.' : 'Bulgu reddedildi.',
  );
  revalidatePath('/', 'layout');
  return r;
}

// ---------------- Kural setleri ----------------

export async function createRuleSetAction(_: ActionState, f: FormData): Promise<ActionState> {
  const overrides: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of f.entries()) {
    const m = /^p:(.+):(.+)$/.exec(key);
    if (!m || value === '' || value === s(f, `orig:${m[1]}:${m[2]}`)) continue;
    (overrides[m[1]] ??= {})[m[2]] = Number(value);
  }
  const r = await act(
    () => api('/rule-sets', { method: 'POST', json: { type: s(f, 'type'), version: s(f, 'version'), effectiveFrom: s(f, 'effectiveFrom'), paramOverrides: overrides, note: s(f, 'note') || undefined } }),
    `Taslak sürüm oluşturuldu (${Object.keys(overrides).length} kuralda değişiklik).`,
  );
  revalidatePath('/koordinator/kurallar');
  return r;
}

export async function activateRuleSetAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/rule-sets/${s(f, 'id')}/activate`, { method: 'POST' }), 'Sürüm etkinleştirildi.');
  revalidatePath('/koordinator/kurallar');
  return r;
}

// ---------------- Yönetim: kullanıcılar ve roller ----------------

export async function createUserAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () => api('/users', { method: 'POST', json: { username: s(f, 'username'), displayName: s(f, 'displayName'), email: s(f, 'email') } }),
    'Kullanıcı eklendi. Kimlik doğrulama hesabının SSO tarafında da açılmış olması gerekir.',
  );
  revalidatePath('/yonetim/kullanicilar');
  return r;
}

export async function assignRoleAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () => api(`/users/${encodeURIComponent(s(f, 'username'))}/assignments`, { method: 'POST', json: { role: s(f, 'role'), programId: s(f, 'programId') || undefined } }),
    'Rol atandı.',
  );
  revalidatePath('/yonetim/kullanicilar');
  return r;
}

export async function unassignRoleAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/assignments/${s(f, 'id')}`, { method: 'DELETE' }), 'Rol kaldırıldı.');
  revalidatePath('/yonetim/kullanicilar');
  return r;
}
