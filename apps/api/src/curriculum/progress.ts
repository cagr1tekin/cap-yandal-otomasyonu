import { GRADE_POINTS, type CourseState, type Grade } from '@cap/contracts';
import type { AttemptResult, PlanItemKind, ReviewStatus } from '@prisma/client';

/**
 * Ders listesinin durum hesabı (saf fonksiyonlar). Kural hesaplarına yalnızca onaylı kayıtlar girer:
 * onay bekleyen, reddedilen ve iptal edilen kayıtlar görünür ama sayılmaz.
 */

export interface AttemptLike {
  id: string;
  termId: string;
  termStart: Date;
  status: ReviewStatus;
  result: AttemptResult;
  grade: string | null;
  ects: number;
  courseCode: string;
}

export interface PlanItemLike {
  id: string;
  kind: PlanItemKind;
  courseCode: string | null;
  ects: number;
  status: ReviewStatus;
  removedAt: Date | null;
  exemptAt: Date | null;
  attempts: AttemptLike[];
}

const byTerm = (a: AttemptLike, b: AttemptLike) => a.termStart.getTime() - b.termStart.getTime();

export function approvedAttempts(item: PlanItemLike) {
  return item.attempts.filter((a) => a.status === 'APPROVED').sort(byTerm);
}

/** E-postadaki durumlar: planlandı, alındı, geçti, kaldı, muaf, çıkarıldı. */
export function itemState(item: PlanItemLike): CourseState {
  if (item.removedAt || item.status === 'CANCELLED' || item.status === 'REJECTED') return 'CIKARILDI';
  if (item.exemptAt) return 'MUAF';
  const approved = approvedAttempts(item);
  if (approved.some((a) => a.result === 'PASSED')) return 'GECTI';
  const last = approved.at(-1);
  if (!last) return 'PLANLANDI';
  return last.result === 'FAILED' ? 'KALDI' : 'ALINDI';
}

/** Kural hesabına giren liste satırı: onaylı ve listeden çıkarılmamış. */
export const counted = (item: PlanItemLike) => item.status === 'APPROVED' && !item.removedAt;
export const done = (item: PlanItemLike) => ['GECTI', 'MUAF'].includes(itemState(item));

export function totals(items: PlanItemLike[]) {
  const list = items.filter(counted);
  const finished = list.filter(done);
  const exempt = list.filter((i) => itemState(i) === 'MUAF');
  const plannedEcts = list.reduce((t, i) => t + i.ects, 0);
  const completedEcts = finished.reduce((t, i) => t + i.ects, 0);
  return {
    plannedCount: list.length,
    plannedEcts,
    completedCount: finished.length,
    completedEcts,
    exemptCount: exempt.length,
    remainingCount: list.length - finished.length,
    remainingEcts: plannedEcts - completedEcts,
    pendingItems: items.filter((i) => i.status === 'PENDING' && !i.removedAt).length,
  };
}

/**
 * Dönem dönem birikimli program ortalaması (eskiden yeniye). Tekrar alınan derste son notlu deneme sayılır;
 * kredisiz (G, K) ve muaf dersler ortalamaya girmez.
 */
export function gpaByTerm(items: PlanItemLike[], termIds: string[]) {
  const out: { termId: string; gpa: number }[] = [];
  for (let i = 0; i < termIds.length; i++) {
    const upTo = new Set(termIds.slice(0, i + 1));
    const termHasGrade = items.filter(counted).some((it) => approvedAttempts(it).some((a) => a.termId === termIds[i] && a.result !== 'TAKEN'));
    if (!termHasGrade) continue;
    let points = 0;
    let ects = 0;
    for (const it of items.filter(counted)) {
      if (it.exemptAt) continue;
      const last = approvedAttempts(it)
        .filter((a) => upTo.has(a.termId) && a.result !== 'TAKEN' && a.grade)
        .at(-1);
      const p = last ? GRADE_POINTS[last.grade as Grade] : null;
      if (last && p !== null && p !== undefined) {
        points += p * last.ects;
        ects += last.ects;
      }
    }
    if (ects) out.push({ termId: termIds[i], gpa: Math.round((points / ects) * 100) / 100 });
  }
  return out;
}

/** Bir dönemde onaylı en az bir deneme var mı (ders aldı mı). */
export function tookCourseIn(items: PlanItemLike[], termId: string) {
  return items.some((it) => it.status === 'APPROVED' && it.attempts.some((a) => a.status === 'APPROVED' && a.termId === termId));
}

export function resultForGrade(grade: string | null | undefined, conditionalPass?: boolean): AttemptResult {
  if (!grade) return 'TAKEN';
  if (['AA', 'BA', 'BB', 'CB', 'CC', 'G'].includes(grade)) return 'PASSED';
  if (grade === 'DC') return conditionalPass ? 'PASSED' : 'FAILED';
  return 'FAILED';
}
