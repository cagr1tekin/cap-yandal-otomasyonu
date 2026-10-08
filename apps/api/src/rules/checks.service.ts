import { Injectable } from '@nestjs/common';
import { evaluate, type EvaluationContext, type RuleResult, type RuleStatus, type StudentSnapshot } from '@cap/rules';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth';
import { AuditService } from '../audit/audit.service';
import { notFound } from '../common/http';
import { counted, gpaByTerm, itemState, tookCourseIn, totals, type PlanItemLike } from '../curriculum/progress';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from './rules.service';

const GANO_KINDS = ['GANO_DROP_STRIKES', 'MAIN_GANO_BELOW'];
const rank: Record<string, number> = { FAIL: 2, WARN: 1 };

export interface CheckOutcome {
  ruleSetId: string;
  version: string;
  inputs: Record<string, unknown>;
  termEnd: RuleResult[];
  plan: RuleResult[];
  graduation: RuleResult[];
  worst: 'OK' | 'WARN' | 'FAIL';
  graduationReady: boolean;
}

/** RuleCheck.results alanının biçimi. */
export interface StoredResults {
  termEnd: RuleResult[];
  plan: RuleResult[];
  graduation: RuleResult[];
  graduationReady: boolean;
}

export const planInclude = {
  attempts: { include: { term: { select: { startsAt: true } } } },
} satisfies Prisma.PlanItemInclude;

export function toLike(items: Prisma.PlanItemGetPayload<{ include: typeof planInclude }>[]): PlanItemLike[] {
  return items.map((i) => ({ ...i, attempts: i.attempts.map((a) => ({ ...a, termStart: a.term.startsAt })) }));
}

/**
 * Yönerge kurallarının öğrenciye uygulanması. Yalnızca onaylı kayıtlar hesaba girer. Her kontrol,
 * kullanılan kural seti sürümü ve girdileriyle saklanır; kural değişse de eski kontroller yeniden yazılmaz.
 * Uyarı karar değildir: kararı koordinatör verir.
 */
@Injectable()
export class ChecksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async compute(studentNo: string, opts: { now?: Date; ruleSetId?: string } = {}): Promise<CheckOutcome> {
    const now = opts.now ?? new Date();
    const s = await this.prisma.student.findUnique({
      where: { studentNo },
      include: {
        admissionTerm: true,
        planItems: { include: planInclude },
        ganoRecords: { where: { cancelledAt: null }, include: { term: true } },
        leaves: { where: { cancelledAt: null } },
      },
    });
    if (!s) throw notFound('Öğrenci');
    const { id: ruleSetId, def } = opts.ruleSetId ? await this.rules.byId(opts.ruleSetId) : await this.rules.active(s.track);
    const terms = await this.prisma.term.findMany({ where: { startsAt: { gte: s.admissionTerm.startsAt, lte: now } }, orderBy: { startsAt: 'asc' } });
    const completed = terms.filter((t) => t.endsAt < now);
    const items = toLike(s.planItems);
    const gano = [...s.ganoRecords].sort((a, b) => a.term.startsAt.getTime() - b.term.startsAt.getTime());
    const latest = gano.at(-1) ?? null;
    const leaveTerms = new Set(s.leaves.map((l) => l.termId));
    const frozenTerms = new Set(gano.filter((g) => g.mainFrozen).map((g) => g.termId));

    // Üst üste ders almama: tamamlanmış dönemler, sondan geriye; izinli ve donuk dönem zinciri bozmaz.
    let streak = 0;
    for (const t of [...completed].reverse()) {
      if (leaveTerms.has(t.id) || frozenTerms.has(t.id)) continue;
      if (tookCourseIn(items, t.id)) break;
      streak++;
    }
    const threshold = (def.rules.find((r) => r.kind === 'GANO_DROP_STRIKES')?.params.threshold as number | undefined) ?? 0;
    const priorStrikes = gano.slice(0, -1).filter((g) => g.gano < threshold).length;
    const gradTerm = gano.find((g) => g.mainGraduated)?.termId ?? null;
    const gradIndex = gradTerm ? terms.findIndex((t) => t.id === gradTerm) : -1;
    const gpas = gpaByTerm(items, terms.map((t) => t.id));
    const sum = totals(items);
    const activeCatalogEcts = (await this.prisma.course.aggregate({ where: { active: true }, _sum: { ects: true } }))._sum.ects ?? 0;
    const list = items.filter(counted);

    const student: StudentSnapshot = {
      studentNo,
      programId: s.mainProgramId ?? '',
      level: 'LISANS',
      durationYears: 4,
      semesterNo: 0,
      gano: latest?.gano ?? 0,
      completedAllCoursesToDate: true,
      classRankPercentile: null,
      entryScore: null,
      yokRankRequirementMet: null,
      talentExamPassedProgramIds: [],
      frozen: latest?.mainFrozen ?? false,
    };
    const ctx: EvaluationContext = {
      student,
      history: {
        mainGano: latest?.gano ?? 0,
        trackGpaByTerm: gpas.map((g) => g.gpa),
        consecutiveTermsWithoutCourse: streak,
        ganoStrikes: priorStrikes,
        onLeave: completed.length ? leaveTerms.has(completed[completed.length - 1].id) : false,
        termsSinceAdmission: terms.length,
        termsSinceMainGraduation: gradTerm ? (gradIndex >= 0 ? terms.length - 1 - gradIndex : 0) : null,
      },
      protocol: { level: 'LISANS', durationYears: 4, courseEcts: sum.plannedEcts, courseCount: sum.plannedCount, commonEcts: s.commonEcts, overlapCodes: [] },
      minorPlan: { poolEcts: activeCatalogEcts, planEcts: sum.plannedEcts, planCourseCount: sum.plannedCount },
      graduation: {
        mainGraduated: !!gradTerm,
        mainGano: latest?.gano ?? 0,
        trackCompleted: list.length > 0 && list.every((i) => ['GECTI', 'MUAF'].includes(itemState(i))),
        trackEcts: sum.completedEcts,
        requiredEcts: sum.plannedEcts,
        trackGpa: gpas.at(-1)?.gpa ?? null,
      },
    };

    const noGano = (r: RuleResult): RuleResult =>
      !latest && GANO_KINDS.includes(r.kind) ? { ...r, status: 'NOT_APPLICABLE', message: 'Ana dal GANO kaydı yok (koordinatör girer).', effects: undefined } : r;
    const termEnd = evaluate(def, 'TERM_END', ctx).results.map(noGano);
    if (!latest && completed.length > 0) {
      termEnd.push({ code: 'VERI-01', kind: 'MISSING_GANO', article: 'Sistem', title: 'Ana dal GANO girilmedi', status: 'WARN', message: 'Tamamlanmış dönem var ama GANO kaydı yok; GANO kuralları değerlendirilemedi.' });
    }
    const plan = list.length ? evaluate(def, 'PROTOCOL', ctx).results : [];
    const graduation = evaluate(def, 'GRADUATION', ctx).results;
    const statuses = [...termEnd, ...plan].map((r) => r.status as RuleStatus);
    const worst = statuses.includes('FAIL') ? 'FAIL' : statuses.includes('WARN') ? 'WARN' : 'OK';
    return {
      ruleSetId,
      version: def.version,
      inputs: { ...ctx.history, mainGano: latest?.gano ?? null, ganoTerm: latest?.termId ?? null, mainGraduatedTerm: gradTerm, plan: sum, commonEcts: s.commonEcts, trackGpa: gpas.at(-1)?.gpa ?? null },
      termEnd,
      plan,
      graduation,
      worst,
      graduationReady: graduation.length > 0 && graduation.every((r) => r.status === 'PASS'),
    };
  }

  /** Kontrolü çalıştırır ve saklar; yeni çıkan uyarıları öğrenciye ve koordinatörlere bildirir. */
  async run(studentNo: string, trigger: string, actor: Pick<AuthUser, 'username' | 'role'> | 'sistem') {
    const out = await this.compute(studentNo);
    const previous = await this.prisma.ruleCheck.findFirst({ where: { studentNo }, orderBy: { createdAt: 'desc' } });
    const check = await this.prisma.ruleCheck.create({
      data: {
        studentNo,
        ruleSetId: out.ruleSetId,
        trigger,
        inputs: out.inputs as object,
        results: { termEnd: out.termEnd, plan: out.plan, graduation: out.graduation, graduationReady: out.graduationReady } as unknown as object,
        worst: out.worst,
        createdBy: actor === 'sistem' ? 'sistem' : actor.username,
      },
    });

    const flagged = (results: RuleResult[]) => results.filter((r) => rank[r.status]).map((r) => `${r.code}:${r.status}`);
    const prev = previous?.results as unknown as StoredResults | undefined;
    const before = new Set(prev ? flagged([...(prev.termEnd ?? []), ...(prev.plan ?? [])]) : []);
    const fresh = [...out.termEnd, ...out.plan].filter((r) => rank[r.status] && !before.has(`${r.code}:${r.status}`));
    const wasReady = !!prev?.graduationReady;
    const student = await this.prisma.student.findUniqueOrThrow({ where: { studentNo }, include: { user: true } });
    const live = student.status === 'ACTIVE' || student.status === 'FROZEN';
    if (live && fresh.length) {
      const text = fresh.map((r) => `- ${r.title}: ${r.message} (${r.article})`).join('\n');
      if (student.user) await this.notifications.notify(student.user.username, 'Yönerge uyarısı', `${text}\n\nUyarı karar değildir; sorularınızı koordinatöre mesajla iletebilirsiniz.`, `/ogrenciler/${studentNo}`);
      await this.notifications.notifyCoordinators(`Uyarı: ${student.fullName} (${studentNo})`, text, `/ogrenciler/${studentNo}`);
    }
    if (live && out.graduationReady && !wasReady) {
      await this.notifications.notifyCoordinators(
        `${student.track === 'CAP' ? 'Mezuniyete' : 'Sertifikaya'} hazır: ${student.fullName}`,
        `${studentNo} numaralı öğrenci ${student.track === 'CAP' ? 'çift ana dal diploması' : 'yan dal sertifikası'} koşullarını sağlıyor. Karar sizde.`,
        `/ogrenciler/${studentNo}`,
      );
    }
    await this.audit.log(actor, { action: 'RULE_CHECK', entity: 'RuleCheck', entityId: check.id, studentNo, after: { trigger, version: out.version, worst: out.worst, graduationReady: out.graduationReady } });
    return { check, outcome: out };
  }

  async runAll(user: AuthUser) {
    const students = await this.prisma.student.findMany({ where: { status: { in: ['ACTIVE', 'FROZEN'] } }, select: { studentNo: true } });
    let warn = 0;
    let fail = 0;
    for (const s of students) {
      const { outcome } = await this.run(s.studentNo, 'TOPLU_KONTROL', user);
      if (outcome.worst === 'WARN') warn++;
      if (outcome.worst === 'FAIL') fail++;
    }
    return { checked: students.length, warn, fail };
  }

  /** Taslak sürümü etkin öğrencilerde dener; sonucu değişenleri listeler (hiçbir şey saklanmaz). */
  async dryRun(ruleSetId: string) {
    const { row } = await this.rules.byId(ruleSetId);
    const students = await this.prisma.student.findMany({ where: { status: { in: ['ACTIVE', 'FROZEN'] }, track: row.type }, select: { studentNo: true, fullName: true } });
    const rows = [];
    for (const s of students) {
      const [before, after] = await Promise.all([this.compute(s.studentNo), this.compute(s.studentNo, { ruleSetId })]);
      const flagged = (o: CheckOutcome) => [...o.termEnd, ...o.plan].filter((r) => rank[r.status]).map((r) => `${r.code}: ${r.message}`);
      rows.push({ studentNo: s.studentNo, fullName: s.fullName, before: before.worst, after: after.worst, changed: before.worst !== after.worst, flagged: flagged(after) });
    }
    return { total: rows.length, changed: rows.filter((r) => r.changed).length, rows };
  }

  history(studentNo: string) {
    return this.prisma.ruleCheck.findMany({ where: { studentNo }, include: { ruleSet: { select: { version: true } } }, orderBy: { createdAt: 'desc' }, take: 30 });
  }

  /** Son kontrolü uyarılı öğrenciler ve mezuniyete hazır olanlar. */
  async overview() {
    const students = await this.prisma.student.findMany({
      where: { status: { in: ['ACTIVE', 'FROZEN'] } },
      select: { studentNo: true, fullName: true, track: true, status: true, ruleChecks: { orderBy: { createdAt: 'desc' }, take: 1, include: { ruleSet: { select: { version: true } } } } },
      orderBy: { studentNo: 'asc' },
    });
    return students.map((s) => {
      const c = s.ruleChecks[0];
      const r = c?.results as unknown as StoredResults | undefined;
      return {
        studentNo: s.studentNo,
        fullName: s.fullName,
        track: s.track,
        status: s.status,
        lastCheck: c ? { id: c.id, at: c.createdAt, worst: c.worst, version: c.ruleSet.version, graduationReady: !!r?.graduationReady, flagged: [...(r?.termEnd ?? []), ...(r?.plan ?? [])].filter((x) => rank[x.status]) } : null,
      };
    });
  }
}
