'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { act, api, ApiError, type ActionState } from '@/lib/api';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

const fail = (e: unknown): ActionState => {
  if (e instanceof ApiError) return { ok: false, message: e.problem.detail ?? e.problem.title, problem: e.problem };
  throw e;
};

// ---- Birim: başvuru girişi (KARARLAR K-1) ----

export async function intakeAction(_: ActionState, f: FormData): Promise<ActionState> {
  let id: string;
  try {
    const res = await api<{ application: { id: string } }>('/applications', {
      method: 'POST',
      json: {
        studentNo: s(f, 'studentNo'),
        offeringId: s(f, 'offeringId'),
        documentNo: s(f, 'documentNo'),
        documentDate: s(f, 'documentDate'),
        documents: f.getAll('documents').map(String),
        osymDocNo: s(f, 'osymDocNo') || undefined,
        osymVerificationCode: s(f, 'osymVerificationCode') || undefined,
        note: s(f, 'note') || undefined,
      },
    });
    id = res.application.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath('/birim/basvurular');
  redirect(`/birim/basvurular/${id}?kaydedildi=1`);
}

export async function withdrawApplicationAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/applications/${s(f, 'id')}/withdraw`, { method: 'POST', json: { reason: s(f, 'reason') } }), 'Başvuru geri çekildi.');
  revalidatePath('/birim/basvurular');
  return r;
}

/** Kesin kayıt: belge kontrolüyle (KARARLAR K-8). */
export async function registerAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () => api(`/applications/${s(f, 'applicationId')}/register`, { method: 'POST', json: { documents: f.getAll('documents').map(String), note: s(f, 'note') || undefined } }),
    'Kesin kayıt yapıldı; koordinatöre protokol için bildirim gitti.',
  );
  revalidatePath('/birim/kararlar');
  return r;
}

// ---- Kayıt: protokol, ders kaydı, izin, ayrılma (KARARLAR K-9, K-10) ----

export async function saveProtocolAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  try {
    const res = await api<{ results: { status: string; title: string; message: string; code: string; article: string }[] }>(`/enrollments/${id}/protocol`, {
      method: 'PUT',
      json: { courseCodes: f.getAll('course').map(String), reason: s(f, 'reason') || undefined },
    });
    revalidatePath(`/kayitlar/${id}`);
    const failed = res.results.filter((r) => r.status === 'FAIL');
    return failed.length
      ? { ok: false, message: 'Taslak kaydedildi, ancak kurallar sağlanmıyor; onaya gönderilemez.', problem: { status: 200, title: '', results: failed } }
      : { ok: true, message: 'Protokol taslağı kaydedildi; kurallar sağlanıyor.' };
  } catch (e) {
    return fail(e);
  }
}

export async function submitProtocolAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(() => api(`/enrollments/${id}/protocol/submit`, { method: 'POST' }), 'Protokol imzacıların onayına gönderildi.');
  revalidatePath(`/kayitlar/${id}`);
  return r;
}

export async function fileProtocolAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(() => api(`/enrollments/${id}/protocol/file`, { method: 'POST' }), 'Protokolün aslı dosyalandı.');
  revalidatePath(`/kayitlar/${id}`);
  revalidatePath('/birim/protokoller');
  return r;
}

export async function saveCourseRegAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(
    () => api(`/enrollments/${id}/course-registration`, { method: 'PUT', json: { termId: s(f, 'termId'), courseCodes: f.getAll('course').map(String) } }),
    'Ders kayıt formu kaydedildi.',
  );
  revalidatePath(`/kayitlar/${id}`);
  return r;
}

export async function submitCourseRegAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(
    () => api(`/enrollments/${id}/course-registration/submit`, { method: 'POST', json: { termId: s(f, 'termId') } }),
    'Ders kayıt formu imzacıların onayına gönderildi.',
  );
  revalidatePath(`/kayitlar/${id}`);
  return r;
}

export async function submitBatchAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const res = await api<{ count: number }>('/course-registrations/submit-batch', { method: 'POST', json: { termId: s(f, 'termId') } });
    revalidatePath('/koordinator/teslim');
    return { ok: true, message: `${res.count} form öğrenci işlerine teslim edildi.` };
  } catch (e) {
    return fail(e);
  }
}

export async function markEnteredAction(_: ActionState, f: FormData): Promise<ActionState> {
  const ids = f.getAll('ids').map(String);
  if (!ids.length) return { ok: false, message: 'En az bir form seçin.' };
  const r = await act(() => api('/course-registrations/mark-entered', { method: 'POST', json: { ids } }), `${ids.length} form OBİS'e girildi olarak işaretlendi.`);
  revalidatePath('/birim/ders-kayitlari');
  return r;
}

export async function leaveAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(
    () => api(`/enrollments/${id}/leaves`, { method: 'POST', json: { termId: s(f, 'termId'), reason: s(f, 'reason'), note: s(f, 'note') || undefined } }),
    'Dönem izni kaydedildi.',
  );
  revalidatePath(`/kayitlar/${id}`);
  return r;
}

export async function withdrawEnrollmentAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(() => api(`/enrollments/${id}/withdrawal`, { method: 'POST', json: { reason: s(f, 'reason') } }), 'Ayrılma işlendi; öğrenciye e-posta gönderildi.');
  revalidatePath(`/kayitlar/${id}`);
  return r;
}

export async function trackAdvisorAction(_: ActionState, f: FormData): Promise<ActionState> {
  const id = s(f, 'enrollmentId');
  const r = await act(() => api(`/enrollments/${id}/track-advisor`, { method: 'PUT', json: { username: s(f, 'username') } }), 'Program danışmanı güncellendi.');
  revalidatePath(`/kayitlar/${id}`);
  return r;
}

// ---- Onaylar ----

export async function decideApprovalAction(_: ActionState, f: FormData): Promise<ActionState> {
  const decision = s(f, 'decision');
  const r = await act(
    () => api(`/approvals/${s(f, 'approvalId')}`, { method: 'POST', json: { decision, comment: s(f, 'comment') || undefined } }),
    decision === 'APPROVED' ? 'Onaylandı.' : 'Reddedildi; koordinatöre bildirildi.',
  );
  revalidatePath('/onaylar');
  revalidatePath('/kayitlar', 'layout');
  return r;
}

// ---- ÖİDB: kullanıcılar ve roller ----

export async function createUserAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () => api('/users', { method: 'POST', json: { username: s(f, 'username'), displayName: s(f, 'displayName'), email: s(f, 'email') } }),
    'Kullanıcı eklendi. Kimlik doğrulama hesabının SSO tarafında da açılmış olması gerekir.',
  );
  revalidatePath('/oidb/kullanicilar');
  return r;
}

export async function assignRoleAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () =>
      api(`/users/${encodeURIComponent(s(f, 'username'))}/assignments`, {
        method: 'POST',
        json: { role: s(f, 'role'), unitId: s(f, 'unitId') || undefined, programId: s(f, 'programId') || undefined },
      }),
    'Rol atandı.',
  );
  revalidatePath('/oidb/kullanicilar');
  return r;
}

export async function unassignRoleAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/assignments/${s(f, 'id')}`, { method: 'DELETE' }), 'Rol kaldırıldı.');
  revalidatePath('/oidb/kullanicilar');
  return r;
}
