'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { act, api, ApiError, type ActionState } from '@/lib/api';

export async function applyAction(_: ActionState, form: FormData): Promise<ActionState> {
  const offeringId = String(form.get('offeringId'));
  const osymDocNo = String(form.get('osymDocNo') ?? '').trim() || undefined;
  const osymVerificationCode = String(form.get('osymVerificationCode') ?? '').trim() || undefined;
  if (form.get('onay') !== 'on') return { ok: false, message: 'Devam etmek için bilgilerinizi onaylayın.' };
  try {
    await api('/applications', { method: 'POST', json: { offeringId, osymDocNo, osymVerificationCode } });
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: e.problem.detail ?? e.problem.title, problem: e.problem };
    throw e;
  }
  revalidatePath('/ogrenci');
  redirect('/ogrenci/basvurularim?gonderildi=1');
}

export async function withdrawApplicationAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  const r = await act(() => api(`/applications/${id}/withdraw`, { method: 'POST' }), 'Başvurunuz geri çekildi.');
  revalidatePath('/ogrenci');
  return r;
}

export async function savePlanAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('enrollmentId'));
  const poolCourseIds = form.getAll('course').map(String);
  const r = await act(
    () => api(`/enrollments/${id}/minor-plan`, { method: 'PUT', json: { poolCourseIds } }),
    'Planınız koordinatör onayına gönderildi.',
  );
  revalidatePath('/ogrenci/programlarim');
  return r;
}

export async function withdrawEnrollmentAction(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('enrollmentId'));
  const reason = String(form.get('reason') ?? '');
  const r = await act(() => api(`/enrollments/${id}/withdrawal`, { method: 'POST', json: { reason } }), 'Programdan ayrıldınız.');
  revalidatePath('/ogrenci/programlarim');
  return r;
}
