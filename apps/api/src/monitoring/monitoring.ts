import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Body, Controller, Get, Injectable, Logger, Param, Patch, Post, Query } from '@nestjs/common';
import { evaluate, type RuleResult, type RuleSetDefinition } from '@cap/rules';
import { FindingDecisionSchema, LABELS, StartScanSchema } from '@cap/contracts';
import type { Term } from '@prisma/client';
import type { Job, Queue } from 'bullmq';
import type { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { conflict, notFound, ZodPipe } from '../common/http';
import { weightedGpa } from '../forms/forms.service';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { ContextService } from '../rules/context.service';
import { RulesService } from '../rules/rules.service';

export const SCAN_QUEUE = 'scan';

/** Tarama bulgusu: kural sonucu + beyanın doğrulanıp doğrulanmadığı. */
type Finding = RuleResult & { verified?: boolean };

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger('Monitoring');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rules: RulesService,
    private readonly context: ContextService,
    private readonly notifications: NotificationsService,
    @InjectQueue(SCAN_QUEUE) private readonly queue: Queue<{ scanId: string }>,
  ) {}

  async start(user: AuthUser, input: z.infer<typeof StartScanSchema>) {
    const [cap, yd] = await Promise.all([this.rules.active('CAP'), this.rules.active('YANDAL')]);
    const scan = await this.prisma.termScan.create({ data: { termId: input.termId, startedBy: user.username, ruleSets: { connect: [{ id: cap.id }, { id: yd.id }] } } });
    await this.audit.log({ actor: user.username, action: 'SCAN_START', entity: 'TermScan', entityId: scan.id, after: input });
    await this.queue.add('run', { scanId: scan.id }, { removeOnComplete: 50, attempts: 1 });
    return scan;
  }

  /**
   * Dönem sonu taraması. Veri kaynağı sistemin kendi kayıtlarıdır (OBİS bağlantısı yoktur, K-12):
   *  - ana dal GNO'su ve dondurma: öğrencinin dönem sonu beyanı (TermRecord),
   *  - ders alıp almadığı: o dönemin imzaları tamamlanmış ders kayıt formu,
   *  - program ortalaması: koordinatörün girdiği notlar.
   */
  async run(scanId: string) {
    const scan = await this.prisma.termScan.update({ where: { id: scanId }, data: { status: 'RUNNING' }, include: { term: true } });
    try {
      const sets: Record<'CAP' | 'YANDAL', { def: RuleSetDefinition }> = { CAP: await this.rules.active('CAP'), YANDAL: await this.rules.active('YANDAL') };
      const terms = await this.prisma.term.findMany({ where: { startsAt: { lte: scan.term.startsAt } }, orderBy: { startsAt: 'asc' } });
      const enrollments = await this.prisma.enrollment.findMany({
        where: { status: { in: ['ACTIVE', 'FROZEN'] }, startTerm: { startsAt: { lte: scan.term.startsAt } } },
        include: {
          student: { include: { user: { select: { username: true } } } },
          startTerm: true,
          termRecords: true,
          leaves: true,
          courseRegistrations: { where: { status: 'APPROVED' }, include: { _count: { select: { items: true } } } },
          protocol: { include: { courses: true } },
        },
      });

      let flaggedStudents = 0;
      for (const e of enrollments) {
        const record = e.termRecords.find((r) => r.termId === scan.termId);
        const mine = terms.filter((t) => t.startsAt >= e.startTerm.startsAt);
        const student = await this.context.student(e.student, record?.mainFrozen ?? false);
        const history = {
          mainGano: record?.mainGano ?? 0,
          trackGpaByTerm: this.gpaByTerm(mine, e.protocol?.courses ?? []),
          consecutiveTermsWithoutCourse: this.withoutCourse(mine, e.courseRegistrations, e.leaves),
          ganoStrikes: e.ganoStrikes,
          onLeave: e.leaves.some((l) => l.termId === scan.termId),
        };
        const out = evaluate(sets[e.type].def, 'TERM_END', { student, history });
        // Beyan yoksa GNO'ya dayalı kurallar çalıştırılmaz; eksik veri ayrı bir bulgu olarak yazılır.
        const usable = record ? out.results : out.results.filter((r) => r.kind === 'CONSECUTIVE_TERMS_NO_COURSE');
        const flagged: Finding[] = usable.filter((r) => r.status === 'WARN' || r.status === 'FAIL').map((r) => ({ ...r, verified: !!record?.verifiedAt }));
        if (!record) {
          flagged.push({
            code: 'VERI-01',
            kind: 'MISSING_TERM_RECORD',
            article: 'KARARLAR K-12',
            title: 'Dönem sonu beyanı eksik',
            status: 'WARN',
            message: 'Öğrenci bu dönem için ana dal GNO beyanını girmedi; GNO kuralları değerlendirilemedi.',
            verified: false,
          });
        }

        // KR-ÇAP-12: ana dalda dondurma kendiliğinden uygulanır (talep aranmaz); diğer etkiler komisyon kararıyla.
        const freeze = flagged.some((r) => r.effects?.freezeEnrollment);
        if (freeze && e.status === 'ACTIVE') {
          await this.prisma.enrollment.update({ where: { id: e.id }, data: { status: 'FROZEN' } });
          await this.audit.log({ actor: 'sistem', action: 'ENROLLMENT_FREEZE', entity: 'Enrollment', entityId: e.id, reason: 'Ana dalda kayıt dondurma (KR-ÇAP-12)' });
        } else if (!freeze && e.status === 'FROZEN' && record && !record.mainFrozen) {
          await this.prisma.enrollment.update({ where: { id: e.id }, data: { status: 'ACTIVE' } });
          await this.audit.log({ actor: 'sistem', action: 'ENROLLMENT_UNFREEZE', entity: 'Enrollment', entityId: e.id });
        }

        for (const r of flagged) {
          const auto = !!r.effects?.freezeEnrollment;
          await this.prisma.scanFinding.create({
            data: { scanId, enrollmentId: e.id, ruleCode: r.code, status: r.status, result: r as unknown as object, decision: auto ? 'CONFIRMED' : 'PENDING', decidedBy: auto ? 'sistem' : null, decidedAt: auto ? new Date() : null },
          });
        }
        if (!flagged.length) continue;
        flaggedStudents++;
        // Öğrenciye uyarılar bildirilir; kayıt silme adayları komisyon kararından sonra bildirilir.
        const warns = flagged.filter((r) => r.status === 'WARN' && !r.effects?.freezeEnrollment);
        if (warns.length) {
          await this.notifications.notify(e.student.user.username, 'Dönem sonu uyarısı', warns.map((r) => `- ${r.title}: ${r.message} (${r.article})`).join('\n'), `/kayitlar/${e.id}`);
        }
      }
      await this.notifications.notifyCoordinators('Dönem sonu taraması tamamlandı', `${enrollments.length} kayıt tarandı, ${flaggedStudents} öğrenci için bulgu var.`, `/koordinator/taramalar/${scanId}`);
      await this.prisma.termScan.update({ where: { id: scanId }, data: { status: 'DONE', finishedAt: new Date() } });
    } catch (e) {
      this.logger.error(e);
      await this.prisma.termScan.update({ where: { id: scanId }, data: { status: 'FAILED', error: String((e as Error).message), finishedAt: new Date() } });
      throw e;
    }
  }

  /** Taranan dönemden geriye doğru, üst üste ders alınmayan dönem sayısı. İzinli dönem sayılmaz ve zinciri bozmaz. */
  private withoutCourse(terms: Term[], regs: { termId: string; _count: { items: number } }[], leaves: { termId: string }[]) {
    let n = 0;
    for (const t of [...terms].reverse()) {
      if (leaves.some((l) => l.termId === t.id)) continue;
      if (regs.some((r) => r.termId === t.id && r._count.items > 0)) break;
      n++;
    }
    return n;
  }

  /** Dönemlere göre birikimli program ortalaması (eskiden yeniye). */
  private gpaByTerm(terms: Term[], courses: { grade: string | null; ects: number; status: 'PENDING' | 'PASSED' | 'FAILED' | 'EXEMPT'; termId: string | null }[]) {
    const out: number[] = [];
    const seen: typeof courses = [];
    for (const t of terms) {
      const graded = courses.filter((c) => c.termId === t.id);
      if (!graded.length) continue;
      seen.push(...graded);
      const gpa = weightedGpa(seen);
      if (gpa !== null) out.push(gpa);
    }
    return out;
  }

  list(termId?: string) {
    return this.prisma.termScan.findMany({
      where: termId ? { termId } : {},
      include: { term: true, _count: { select: { findings: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async get(id: string) {
    const scan = await this.prisma.termScan.findUnique({
      where: { id },
      include: {
        term: true,
        ruleSets: { select: { id: true, version: true, type: true } },
        findings: { include: { enrollment: { include: { student: { include: { program: true } } } } }, orderBy: [{ status: 'asc' }] },
      },
    });
    if (!scan) throw notFound('Tarama');
    return {
      ...scan,
      findings: scan.findings.map((f) => ({
        id: f.id,
        enrollmentId: f.enrollmentId,
        ruleCode: f.ruleCode,
        status: f.status,
        result: f.result,
        decision: f.decision,
        decidedBy: f.decidedBy,
        decidedAt: f.decidedAt,
        reason: f.reason,
        studentNo: f.enrollment.studentNo,
        fullName: f.enrollment.student.fullName,
        mainProgramName: f.enrollment.student.program.name,
        type: f.enrollment.type,
        enrollmentStatus: f.enrollment.status,
      })),
    };
  }

  /** Komisyon her bulguyu onaylar ya da gerekçeyle reddeder. Kayıt silme yalnızca burada olur. */
  async decide(user: AuthUser, id: string, decision: 'CONFIRMED' | 'DISMISSED', reason: string) {
    const f = await this.prisma.scanFinding.findUnique({ where: { id }, include: { scan: true, enrollment: { include: { student: { include: { user: { select: { username: true } } } } } } } });
    if (!f) throw notFound('Bulgu');
    if (f.decision !== 'PENDING') throw conflict('Bu bulgu için zaten karar verildi.');
    const result = f.result as unknown as Finding;
    // Öğrencinin kendi beyanına dayanan bir bulgu, beyan belgeyle doğrulanmadan sonuç doğurmaz.
    if (decision === 'CONFIRMED' && result.effects?.incrementGanoStrikes && !result.verified) {
      const rec = await this.prisma.termRecord.findUnique({ where: { enrollmentId_termId: { enrollmentId: f.enrollmentId, termId: f.scan.termId } } });
      if (!rec?.verifiedAt) throw conflict('Bu bulgu öğrencinin doğrulanmamış GNO beyanına dayanıyor. Önce kayıt sayfasında dönem beyanını transkriptle doğrulayın.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.scanFinding.update({ where: { id }, data: { decision, reason, decidedBy: user.username, decidedAt: new Date() } });
      if (decision === 'CONFIRMED') {
        if (result.effects?.incrementGanoStrikes) await tx.enrollment.update({ where: { id: f.enrollmentId }, data: { ganoStrikes: { increment: 1 } } });
        if (f.status === 'FAIL' && (f.enrollment.status === 'ACTIVE' || f.enrollment.status === 'FROZEN')) {
          await tx.enrollment.update({ where: { id: f.enrollmentId }, data: { status: 'REMOVED' } });
        }
      }
      await this.audit.log({ actor: user.username, action: `FINDING_${decision}`, entity: 'ScanFinding', entityId: id, after: { ruleCode: f.ruleCode, status: f.status }, reason }, tx);
    });

    if (decision === 'CONFIRMED' && f.status === 'FAIL') {
      await this.notifications.notify(
        f.enrollment.student.user.username,
        'Kaydınız silindi',
        `Bilgisayar Mühendisliği ${LABELS.track[f.enrollment.type].toLowerCase()} kaydınız silindi.\nGerekçe: ${result.title} — ${result.message} (${result.article})\nKarar: ${reason}`,
        `/kayitlar/${f.enrollmentId}`,
      );
    }
    return { ok: true };
  }
}

@Processor(SCAN_QUEUE)
export class ScanProcessor extends WorkerHost {
  constructor(private readonly monitoring: MonitoringService) {
    super();
  }

  async process(job: Job<{ scanId: string }>) {
    await this.monitoring.run(job.data.scanId);
  }
}

@Controller()
@Roles('KOORDINATOR', 'BOLUM_BASKANI')
export class MonitoringController {
  constructor(
    private readonly monitoring: MonitoringService,
    private readonly access: AccessService,
  ) {}

  @Post('scans')
  @Roles('KOORDINATOR')
  start(@CurrentUser() user: AuthUser, @Body(new ZodPipe(StartScanSchema)) body: z.infer<typeof StartScanSchema>) {
    return this.monitoring.start(user, body);
  }

  @Get('scans')
  async list(@CurrentUser() user: AuthUser, @Query('termId') termId?: string) {
    await this.access.assertDepartmentStaff(user);
    return this.monitoring.list(termId);
  }

  @Get('scans/:id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.access.assertDepartmentStaff(user);
    return this.monitoring.get(id);
  }

  @Patch('scan-findings/:id')
  @Roles('KOORDINATOR')
  decide(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(FindingDecisionSchema)) body: z.infer<typeof FindingDecisionSchema>) {
    return this.monitoring.decide(user, id, body.decision, body.reason);
  }
}
