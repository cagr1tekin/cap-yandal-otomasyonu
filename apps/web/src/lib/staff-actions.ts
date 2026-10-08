'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { act, api, ApiError, type ActionState } from '@/lib/api';
import { fromLocalInput } from '@/lib/format';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

// ---- Koordinatör ----

export async function overrideAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () => api(`/rankings/${s(f, 'applicationId')}`, { method: 'PATCH', json: { proposal: s(f, 'proposal'), reason: s(f, 'reason') } }),
    'Öneri güncellendi.',
  );
  revalidatePath('/koordinator');
  return r;
}

export async function lockAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/offerings/${s(f, 'offeringId')}/ranking/lock`, { method: 'POST' }), 'Bölüm önerisi kilitlendi ve birime iletildi.');
  revalidatePath('/koordinator');
  return r;
}

// ---- Birim: teklifler ve takvim ----

export async function updateOfferingAction(_: ActionState, f: FormData): Promise<ActionState> {
  const body: Record<string, unknown> = {
    quota: Number(s(f, 'quota')),
    coordinatorUsername: s(f, 'coordinatorUsername'),
    quotaJustification: s(f, 'quotaJustification') || undefined,
    status: s(f, 'status') || undefined,
  };
  if (s(f, 'firstYearIntake')) body.firstYearIntake = Number(s(f, 'firstYearIntake'));
  try {
    const res = await api<{ warnings: { code: string; message: string }[] }>(`/offerings/${s(f, 'offeringId')}`, { method: 'PATCH', json: body });
    revalidatePath('/birim/teklifler');
    return res.warnings.length
      ? { ok: true, message: 'Kaydedildi; uyarı var.', problem: { status: 200, title: '', warnings: res.warnings } }
      : { ok: true, message: 'Kaydedildi.' };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: e.problem.detail ?? e.problem.title, problem: e.problem };
    throw e;
  }
}

export async function createOfferingAction(_: ActionState, f: FormData): Promise<ActionState> {
  const pool = s(f, 'pool')
    .split(/\r?\n/)
    .map((l) => l.split(';').map((x) => x.trim()))
    .filter((p) => p.length >= 3 && p[0])
    .map(([courseCode, name, ects]) => ({ courseCode, name, ects: Number(ects) }));
  const body = {
    programId: s(f, 'programId'),
    termId: s(f, 'termId'),
    type: s(f, 'type'),
    quota: Number(s(f, 'quota')),
    coordinatorUsername: s(f, 'coordinatorUsername'),
    sourceProgramIds: f.getAll('sourceProgramIds').map(String),
    firstYearIntake: s(f, 'firstYearIntake') ? Number(s(f, 'firstYearIntake')) : null,
    quotaJustification: s(f, 'quotaJustification') || undefined,
    poolCourses: pool.length ? pool : undefined,
  };
  try {
    const res = await api<{ warnings: { code: string; message: string }[] }>('/offerings', { method: 'POST', json: body });
    revalidatePath('/birim/teklifler');
    return res.warnings.length
      ? { ok: true, message: 'Teklif taslak olarak oluşturuldu; uyarı var.', problem: { status: 200, title: '', warnings: res.warnings } }
      : { ok: true, message: 'Teklif taslak olarak oluşturuldu. Yayımlamak için listeden durumunu değiştirin.' };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: e.problem.detail ?? e.problem.title, problem: e.problem };
    throw e;
  }
}

export async function windowAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () =>
      api(`/units/${s(f, 'unitId')}/windows`, {
        method: 'PUT',
        json: {
          termId: s(f, 'termId'),
          type: s(f, 'type'),
          opensAt: fromLocalInput(s(f, 'opensAt')),
          closesAt: fromLocalInput(s(f, 'closesAt')),
          announceAt: s(f, 'announceAt') ? fromLocalInput(s(f, 'announceAt')) : undefined,
          registrationDeadline: s(f, 'registrationDeadline') ? fromLocalInput(s(f, 'registrationDeadline')) : undefined,
          waitlistDeadline: s(f, 'waitlistDeadline') ? fromLocalInput(s(f, 'waitlistDeadline')) : undefined,
          courseRegistrationDeadline: s(f, 'courseRegistrationDeadline') ? fromLocalInput(s(f, 'courseRegistrationDeadline')) : undefined,
        },
      }),
    'Takvim kaydedildi.',
  );
  revalidatePath('/birim/takvim');
  return r;
}

export async function closeWindowAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () => api(`/units/${s(f, 'unitId')}/windows/close-now`, { method: 'POST', json: { termId: s(f, 'termId'), type: s(f, 'type') } }),
    'Başvuru dönemi kapatıldı.',
  );
  revalidatePath('/birim/takvim');
  return r;
}

// ---- Birim: kararlar ----

export async function decisionAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () => api(`/offerings/${s(f, 'offeringId')}/decision`, { method: 'POST', json: { decisionDate: s(f, 'decisionDate'), decisionNo: s(f, 'decisionNo') } }),
    'Yönetim kurulu kararı kaydedildi.',
  );
  revalidatePath('/birim/kararlar');
  return r;
}

export async function publishAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/offerings/${s(f, 'offeringId')}/publish`, { method: 'POST' }), 'Sonuçlar yayımlandı; öğrencilere bildirim gönderildi.');
  revalidatePath('/birim/kararlar');
  return r;
}

export async function closeRegistrationAction(_: ActionState, f: FormData): Promise<ActionState> {
  try {
    const res = await api<{ dropped: number; promoted: string[] }>(`/offerings/${s(f, 'offeringId')}/close-registration`, { method: 'POST' });
    revalidatePath('/birim/kararlar');
    return { ok: true, message: `Kayıt dönemi kapatıldı: ${res.dropped} öğrenci kayıt yaptırmadı, ${res.promoted.length} yedek asile çağrıldı.` };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: e.problem.detail ?? e.problem.title, problem: e.problem };
    throw e;
  }
}

// ---- Birim: taramalar ----

export async function startScanAction(_: ActionState, f: FormData): Promise<ActionState> {
  let id: string;
  try {
    const res = await api<{ id: string }>('/scans', { method: 'POST', json: { termId: s(f, 'termId'), unitId: s(f, 'unitId') || undefined } });
    id = res.id;
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, message: e.problem.detail ?? e.problem.title, problem: e.problem };
    throw e;
  }
  revalidatePath('/birim/taramalar');
  redirect(`/birim/taramalar/${id}`);
}

export async function findingAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(
    () => api(`/scan-findings/${s(f, 'findingId')}`, { method: 'PATCH', json: { decision: s(f, 'decision'), reason: s(f, 'reason') } }),
    s(f, 'decision') === 'CONFIRMED' ? 'Bulgu onaylandı.' : 'Bulgu reddedildi.',
  );
  revalidatePath('/birim/taramalar');
  return r;
}

// ---- ÖİDB: kurallar ----

export async function createRuleSetAction(_: ActionState, f: FormData): Promise<ActionState> {
  const overrides: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of f.entries()) {
    const m = /^p:(.+):(.+)$/.exec(key);
    if (!m || value === '' || value === s(f, `orig:${m[1]}:${m[2]}`)) continue;
    (overrides[m[1]] ??= {})[m[2]] = Number(value);
  }
  const r = await act(
    () =>
      api('/rule-sets', {
        method: 'POST',
        json: { type: s(f, 'type'), version: s(f, 'version'), effectiveFrom: s(f, 'effectiveFrom'), paramOverrides: overrides, note: s(f, 'note') || undefined },
      }),
    `Taslak sürüm oluşturuldu (${Object.keys(overrides).length} kuralda değişiklik).`,
  );
  revalidatePath('/oidb/kurallar');
  return r;
}

export async function activateRuleSetAction(_: ActionState, f: FormData): Promise<ActionState> {
  const r = await act(() => api(`/rule-sets/${s(f, 'id')}/activate`, { method: 'POST' }), 'Sürüm etkinleştirildi.');
  revalidatePath('/oidb/kurallar');
  return r;
}
