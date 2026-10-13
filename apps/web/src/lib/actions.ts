'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { act, api, ApiError, type ActionState } from '@/lib/api';
import { fromLocalInput } from '@/lib/format';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const opt = (f: FormData, k: string) => s(f, k) || undefined;
const num = (f: FormData, k: string) => s(f, k).replace(',', '.');

const fail = (e: unknown): ActionState => {
  if (e instanceof ApiError) return { ok: false, message: e.problem.detail ?? e.problem.title, problem: e.problem };
  throw e;
};

/** Öğrenci kartındaki her işlemden sonra kartın bütün sekmeleri tazelenir. */
const card = (no: string) => {
  revalidatePath(`/ogrenciler/${no}`);
  revalidatePath('/', 'layout');
};

const no = (f: FormData) => {
  const v = s(f, 'studentNo');
  // Yol parametresine yalnızca öğrenci numarası girebilir.
  if (!/^\d{9}$/.test(v)) throw new Error('Geçersiz öğrenci numarası');
  return v;
};

/** Dosyayı ve alanları API'ye çok parçalı olarak iletir. */
function multipart(f: FormData, fields: string[]) {
  const body = new FormData();
  for (const k of fields) {
    const v = s(f, k);
    if (v) body.set(k, v);
  }
  const file = f.get('file');
  if (file instanceof File && file.size > 0) body.set('file', file, file.name);
  return body;
}

// ---------------- Öğrenciler ----------------

export async function createStudentAction(_: ActionState, f: FormData): Promise<ActionState> {
  let created: string;
  try {
    const r = await api<{ studentNo: string; inviteLink: string | null }>('/students', {
      method: 'POST',
      json: {
        studentNo: s(f, 'studentNo'),
        fullName: s(f, 'fullName'),
        schoolEmail: s(f, 'schoolEmail'),
        track: s(f, 'track'),
        admissionTermId: s(f, 'admissionTermId'),
        mainProgramId: opt(f, 'mainProgramId'),
        sendInvite: f.get('sendInvite') === 'on',
      },
    });
    created = r.studentNo;
    // E-posta kapalıysa bağlantı burada gösterilir (karta geçince kaybolurdu).
    if (r.inviteLink) {
      revalidatePath('/ogrenciler');
      return { ok: true, message: `Öğrenci eklendi (${created}). Şifre belirleme bağlantısı:`, link: r.inviteLink };
    }
  } catch (e) {
    return fail(e);
  }
  revalidatePath('/ogrenciler');
  redirect(`/ogrenciler/${created}?eklendi=1`);
}

export async function updateStudentAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  const r = await act(
    () =>
      api(`/students/${n}`, {
        method: 'PATCH',
        json: {
          fullName: opt(f, 'fullName'),
          schoolEmail: opt(f, 'schoolEmail'),
          track: opt(f, 'track'),
          admissionTermId: opt(f, 'admissionTermId'),
          mainProgramId: s(f, 'mainProgramId') || null,
          commonEcts: s(f, 'commonEcts') ? Number(s(f, 'commonEcts')) : undefined,
          reason: s(f, 'reason'),
        },
      }),
    'Öğrenci bilgileri güncellendi.',
  );
  card(n);
  return r;
}

export async function contactAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  const r = await act(() => api(`/students/${n}/contact`, { method: 'PUT', json: { phone: s(f, 'phone') } }), 'İletişim bilgisi kaydedildi.');
  card(n);
  return r;
}

export async function inviteAction(_: ActionState, f: FormData): Promise<ActionState> {
  let r: { link: string | null };
  try {
    r = await api<{ link: string | null }>(`/users/${encodeURIComponent(s(f, 'username'))}/invite`, { method: 'POST' });
  } catch (e) {
    return fail(e);
  }
  revalidatePath('/', 'layout');
  return r.link ? { ok: true, message: 'Şifre belirleme bağlantısı oluşturuldu.', link: r.link } : { ok: true, message: 'Şifre belirleme bağlantısı e-postayla gönderildi.' };
}

// ---------------- Ders listesi, dönem dersleri, notlar ----------------

export async function addPlanAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  const r = await act(() => api(`/students/${n}/plan`, { method: 'POST', json: { courseCode: s(f, 'courseCode'), reason: opt(f, 'reason') } }), 'Ders listeye eklendi.');
  card(n);
  return r;
}

export async function templateAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  try {
    const res = await api<{ added: number }>(`/students/${n}/plan/template`, { method: 'POST', json: { templateId: s(f, 'templateId'), reason: s(f, 'reason') } });
    card(n);
    return { ok: true, message: `${res.added} satır listeye eklendi.` };
  } catch (e) {
    return fail(e);
  }
}

export async function planOpAction(_: ActionState, f: FormData): Promise<ActionState> {
  const op = s(f, 'op');
  if (!['remove', 'exempt', 'unexempt', 'cancel'].includes(op)) return { ok: false, message: 'Geçersiz işlem.' };
  const json = op === 'exempt' ? { reason: s(f, 'reason'), conditionNo: s(f, 'conditionNo') ? Number(s(f, 'conditionNo')) : undefined } : { reason: s(f, 'reason') };
  const msg = { remove: 'Ders listeden çıkarıldı.', exempt: 'Ders muaf sayıldı.', unexempt: 'Muafiyet kaldırıldı.', cancel: 'Kayıt iptal edildi.' }[op];
  const r = await act(() => api(`/plan-items/${encodeURIComponent(s(f, 'id'))}/${op}`, { method: 'POST', json }), msg!);
  card(no(f));
  return r;
}

export async function addAttemptAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  const r = await act(
    () => api(`/students/${n}/attempts`, { method: 'POST', json: { planItemId: s(f, 'planItemId'), termId: s(f, 'termId'), courseCode: opt(f, 'courseCode') } }),
    'Dönem dersi girildi.',
  );
  card(n);
  return r;
}

export async function backfillAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  const r = await act(
    () =>
      api(`/students/${n}/attempts/backfill`, {
        method: 'POST',
        json: { planItemId: s(f, 'planItemId'), termId: s(f, 'termId'), courseCode: opt(f, 'courseCode'), grade: opt(f, 'grade'), passed: f.get('passed') === 'on', note: opt(f, 'note') },
      }),
    'Geçmiş dönem kaydı girildi.',
  );
  card(n);
  return r;
}

export async function correctAttemptAction(_: ActionState, f: FormData): Promise<ActionState> {
  const grade = s(f, 'grade');
  const r = await act(
    () =>
      api(`/attempts/${encodeURIComponent(s(f, 'id'))}`, {
        method: 'PATCH',
        json: { termId: opt(f, 'termId'), grade: grade === '-' ? null : grade || undefined, passed: f.get('passed') === 'on', reason: s(f, 'reason') },
      }),
    'Kayıt düzeltildi; eski ve yeni değer işlem kaydına yazıldı.',
  );
  card(no(f));
  return r;
}

export async function cancelRecordAction(_: ActionState, f: FormData): Promise<ActionState> {
  const kind = s(f, 'kind');
  const paths: Record<string, string> = {
    attempt: 'attempts',
    grades: 'grade-submissions',
    plan: 'plan-items',
    document: 'documents',
    request: 'document-requests',
    gano: 'gano',
    leave: 'leaves',
    note: 'notes',
    decision: 'decisions',
  };
  if (!paths[kind]) return { ok: false, message: 'Geçersiz kayıt türü.' };
  const r = await act(() => api(`/${paths[kind]}/${encodeURIComponent(s(f, 'id'))}/cancel`, { method: 'POST', json: { reason: s(f, 'reason') } }), 'Kayıt iptal edildi; silinmedi, iptal durumunda kalır.');
  card(no(f));
  return r;
}

export async function gradesAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  const grades: { attemptId: string; grade: string }[] = [];
  for (const [key, value] of f.entries()) {
    if (key.startsWith('grade:') && value) grades.push({ attemptId: key.slice(6), grade: String(value) });
  }
  if (!grades.length) return { ok: false, message: 'En az bir dersin notunu seçin.' };
  const r = await act(
    () => api(`/students/${n}/grade-submissions`, { method: 'POST', json: { termId: s(f, 'termId'), transcriptId: s(f, 'transcriptId'), grades } }),
    'Notlar ve not belgesi gönderildi.',
  );
  card(n);
  return r;
}

export async function reviewAction(_: ActionState, f: FormData): Promise<ActionState> {
  const kind = s(f, 'kind');
  if (!['plan', 'attempt', 'grades', 'document'].includes(kind)) return { ok: false, message: 'Geçersiz kayıt türü.' };
  const decision = s(f, 'decision');
  const r = await act(
    () =>
      api(`/reviews/${kind}/${encodeURIComponent(s(f, 'id'))}`, {
        method: 'POST',
        json: { decision, note: opt(f, 'note'), conditionalPass: f.getAll('conditionalPass').map(String) },
      }),
    decision === 'APPROVED' ? 'Onaylandı ve kilitlendi.' : 'Reddedildi; öğrenciye gerekçesiyle bildirildi.',
  );
  revalidatePath('/', 'layout');
  return r;
}

// ---------------- Katalog ve talepler ----------------

export async function courseRequestAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  const r = await act(() => api(`/students/${n}/course-requests`, { method: 'POST', json: { code: opt(f, 'code'), name: s(f, 'name'), note: s(f, 'note') } }), 'Talebiniz koordinatöre iletildi.');
  card(n);
  return r;
}

export async function reviewCourseRequestAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () =>
      api(`/course-requests/${encodeURIComponent(s(f, 'id'))}/review`, {
        method: 'POST',
        json: { decision: s(f, 'decision'), courseCode: opt(f, 'courseCode'), note: opt(f, 'note'), addToPlan: f.get('addToPlan') === 'on' },
      }),
    'Talep sonuçlandırıldı.',
  );
  revalidatePath('/', 'layout');
  return r;
}

export async function courseAction(_: ActionState, f: FormData): Promise<ActionState> {
  const code = s(f, 'code').toUpperCase();
  const base = { name: s(f, 'name'), ects: s(f, 'ects'), credit: s(f, 'credit') ? s(f, 'credit') : null, semester: s(f, 'semester'), kind: s(f, 'kind') };
  const r = await act(
    () =>
      s(f, 'mode') === 'update'
        ? api(`/courses/${encodeURIComponent(code)}`, { method: 'PATCH', json: { ...base, active: f.get('active') === 'on', reason: s(f, 'reason') } })
        : api('/courses', { method: 'POST', json: { code, ...base } }),
    s(f, 'mode') === 'update' ? 'Ders güncellendi; öğrenci kayıtları eski bilgiyi korur.' : 'Ders kataloğa eklendi.',
  );
  revalidatePath('/katalog');
  return r;
}

// ---------------- Belgeler ----------------

export async function uploadAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  const file = f.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: 'Yüklenecek dosyayı seçin.' };
  const r = await act(() => api(`/students/${n}/documents`, { method: 'POST', body: multipart(f, ['kind', 'termId', 'replacesId', 'requestId', 'note']) }), 'Belge yüklendi.');
  card(n);
  return r;
}

export async function documentRequestAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  const r = await act(
    () => api(`/students/${n}/document-requests`, { method: 'POST', json: { kind: s(f, 'kind'), termId: opt(f, 'termId'), message: s(f, 'message'), dueDate: opt(f, 'dueDate') } }),
    'Belge isteği öğrenciye gönderildi.',
  );
  card(n);
  return r;
}

// ---------------- Mesaj ve notlar ----------------

export async function messageAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  const r = await act(() => api(`/students/${n}/messages`, { method: 'POST', body: multipart(f, ['body', 'attachmentKind']) }), 'Mesaj gönderildi.');
  card(n);
  return r;
}

export async function noteAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  const r = await act(() => api(`/students/${n}/notes`, { method: 'POST', json: { body: s(f, 'body') } }), 'Not eklendi (öğrenci görmez).');
  card(n);
  return r;
}

// ---------------- GANO, izin, karar, kontrol ----------------

export async function ganoAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  const r = await act(
    () =>
      api(`/students/${n}/gano`, {
        method: 'POST',
        json: { termId: s(f, 'termId'), gano: num(f, 'gano'), source: s(f, 'source'), sourceNote: opt(f, 'sourceNote'), mainFrozen: f.get('mainFrozen') === 'on', mainGraduated: f.get('mainGraduated') === 'on' },
      }),
    'GANO kaydedildi; kurallar yeniden kontrol edildi.',
  );
  card(n);
  return r;
}

export async function leaveAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  const r = await act(() => api(`/students/${n}/leaves`, { method: 'POST', json: { termId: s(f, 'termId'), reason: s(f, 'reason'), note: opt(f, 'note') } }), 'Dönem izni kaydedildi.');
  card(n);
  return r;
}

export async function decisionAction(_: ActionState, f: FormData): Promise<ActionState> {
  const n = no(f);
  const r = await act(
    () => api(`/students/${n}/decisions`, { method: 'POST', json: { type: s(f, 'type'), reason: s(f, 'reason'), reference: opt(f, 'reference') } }),
    'Karar kaydedildi.',
  );
  card(n);
  return r;
}

export async function runAllChecksAction(): Promise<ActionState> {
  try {
    const res = await api<{ checked: number; warn: number; fail: number }>('/checks/run-all', { method: 'POST' });
    revalidatePath('/', 'layout');
    return { ok: true, message: `${res.checked} öğrenci kontrol edildi: ${res.fail} kayıt silme uyarısı, ${res.warn} uyarı.` };
  } catch (e) {
    return fail(e);
  }
}

// ---------------- Kurallar ve ayarlar ----------------

export async function createRuleSetAction(_: ActionState, f: FormData): Promise<ActionState> {
  const overrides: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of f.entries()) {
    const m = /^p:(.+):(.+)$/.exec(key);
    if (!m || value === '' || value === s(f, `orig:${m[1]}:${m[2]}`)) continue;
    (overrides[m[1]] ??= {})[m[2]] = Number(String(value).replace(',', '.'));
  }
  const r = await act(
    () => api('/rule-sets', { method: 'POST', json: { type: s(f, 'type'), version: s(f, 'version'), effectiveFrom: s(f, 'effectiveFrom'), paramOverrides: overrides, note: opt(f, 'note') } }),
    `Taslak sürüm oluşturuldu (${Object.keys(overrides).length} kuralda değişiklik). Deneyip etkinleştirin.`,
  );
  revalidatePath('/kurallar');
  return r;
}

export async function activateRuleSetAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/rule-sets/${encodeURIComponent(s(f, 'id'))}/activate`, { method: 'POST' }), 'Sürüm etkinleştirildi; eski sürüm ve eski kontroller saklandı.');
  revalidatePath('/kurallar');
  return r;
}

export async function settingsAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () => api('/settings', { method: 'PUT', json: { uploadMaxMb: s(f, 'uploadMaxMb'), uploadTypes: f.getAll('uploadTypes').map(String), messageMaxLength: s(f, 'messageMaxLength') } }),
    'Ayarlar kaydedildi.',
  );
  revalidatePath('/ayarlar');
  return r;
}

export async function termAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () => api('/terms', { method: 'POST', json: { year: s(f, 'year'), season: s(f, 'season'), startsAt: fromLocalInput(`${s(f, 'startsAt')}T00:00`), endsAt: fromLocalInput(`${s(f, 'endsAt')}T23:59`) } }),
    'Dönem eklendi.',
  );
  revalidatePath('/ayarlar');
  return r;
}

export async function currentTermAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/terms/${encodeURIComponent(s(f, 'id'))}/current`, { method: 'POST' }), 'İçinde bulunulan dönem değiştirildi.');
  revalidatePath('/', 'layout');
  return r;
}

export async function saveTemplateAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'id');
  let saved: { id: string };
  try {
    const catalog = await api<{ code: string; name: string; ects: number; semester: number }[]>('/courses?all=1');
    const picked = f.getAll('course').map(String);
    const items: { kind: string; code: string | null; name: string; ects: number; semester: number }[] = [];
    for (let semester = 1; semester <= 8; semester++) {
      for (const c of catalog.filter((x) => x.semester === semester && picked.includes(x.code))) items.push({ kind: 'COURSE', code: c.code, name: c.name, ects: c.ects, semester });
      const slots = Number(s(f, `slots:${semester}`) || 0);
      for (let i = 0; i < slots; i++) items.push({ kind: 'ELECTIVE_SLOT', code: null, name: `${semester}. Yarıyıl Teknik Seçmeli Ders`, ects: 4, semester });
    }
    const conditions = [];
    for (let i = 0; f.has(`cond:no:${i}`); i++) {
      if (!s(f, `cond:src:${i}`) && !s(f, `cond:target:${i}`)) continue;
      conditions.push({ no: Number(s(f, `cond:no:${i}`)), sourceCourseCode: s(f, `cond:src:${i}`), sourceCourseName: s(f, `cond:srcName:${i}`), targetCourseCode: s(f, `cond:target:${i}`), note: opt(f, `cond:note:${i}`) });
    }
    const body = { type: s(f, 'type'), sourceProgramId: s(f, 'sourceProgramId') || null, title: s(f, 'title'), commonEcts: Number(s(f, 'commonEcts') || 0), items, conditions };
    saved = await api<{ id: string }>(id ? `/protocol-templates/${encodeURIComponent(id)}` : '/protocol-templates', { method: id ? 'PUT' : 'POST', json: body });
  } catch (e) {
    return fail(e);
  }
  revalidatePath('/sablonlar', 'layout');
  if (!id) redirect(`/sablonlar/${saved.id}`);
  return { ok: true, message: 'Şablon kaydedildi.' };
}

// ---------------- Hesaplar ve aktarım ----------------

export async function createStaffAction(_: ActionState, f: FormData): Promise<ActionState> {
  let r: { inviteLink: string | null };
  try {
    r = await api<{ inviteLink: string | null }>('/users', { method: 'POST', json: { username: s(f, 'username'), displayName: s(f, 'displayName'), email: s(f, 'email'), role: s(f, 'role') } });
  } catch (e) {
    return fail(e);
  }
  revalidatePath('/kullanicilar');
  return r.inviteLink ? { ok: true, message: 'Hesap açıldı.', link: r.inviteLink } : { ok: true, message: 'Hesap açıldı; şifre belirleme bağlantısı e-postayla gönderildi.' };
}

export async function accountStateAction(_: ActionState, f: FormData): Promise<ActionState> {
  const op = s(f, 'op') === 'activate' ? 'activate' : 'deactivate';
  const r = await act(() => api(`/users/${encodeURIComponent(s(f, 'id'))}/${op}`, { method: 'POST', json: { reason: s(f, 'reason') } }), op === 'activate' ? 'Hesap etkinleştirildi.' : 'Hesap pasife alındı.');
  revalidatePath('/kullanicilar');
  return r;
}

/** CSV'yi satırlara çevirir (ayraç ; ya da ,). İlk satır başlıktır. */
function parseCsv(text: string) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const head = lines[0].split(sep).map((h) => h.trim());
  return lines.slice(1).map((l) => Object.fromEntries(l.split(sep).map((v, i) => [head[i] ?? `c${i}`, v.trim().replace(/^"|"$/g, '')])));
}

export type ImportState = (NonNullable<ActionState> & { result?: { commit: boolean; ok: number; errors: number; results: { row: number; key: string; action: string; message: string }[] }; csv?: string; kind?: string }) | null;

export async function importAction(_: ImportState, f: FormData): Promise<ImportState> {
  const file = f.get('file');
  const csv = file instanceof File && file.size > 0 ? await file.text() : s(f, 'csv');
  if (csv.length > 1_000_000) return { ok: false, message: 'Dosya çok büyük (en çok 1 MB).' };
  const rows = parseCsv(csv);
  if (!rows.length) return { ok: false, message: 'CSV boş ya da yalnızca başlık satırı var.' };
  const commit = s(f, 'mode') === 'commit';
  try {
    const result = await api<NonNullable<ImportState>['result']>('/imports', { method: 'POST', json: { kind: s(f, 'kind'), rows, commit } });
    revalidatePath('/', 'layout');
    return { ok: true, message: commit ? `Aktarım tamamlandı: ${result!.ok} satır işlendi, ${result!.errors} hata.` : 'Deneme: hiçbir şey yazılmadı. Sonucu inceleyip aktarın.', result, csv, kind: s(f, 'kind') };
  } catch (e) {
    return { ...fail(e)!, csv, kind: s(f, 'kind') };
  }
}
