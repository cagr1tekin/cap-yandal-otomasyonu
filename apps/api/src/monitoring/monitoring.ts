import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Body, Controller, Get, Injectable, Logger, Param, Patch, Post, Query } from '@nestjs/common';
import { evaluate, type RuleResult } from '@cap/rules';
import { FindingDecisionSchema, LABELS, StartScanSchema } from '@cap/contracts';
import type { Job, Queue } from 'bullmq';
import type { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { conflict, notFound, ZodPipe } from '../common/http';
import { ObisPort } from '../integrations/obis.port';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { ContextService } from '../rules/context.service';
import { RulesService } from '../rules/rules.service';

export const SCAN_QUEUE = 'scan';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger('Monitoring');

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly rules: RulesService,
    private readonly context: ContextService,
    private readonly obis: ObisPort,
    private readonly notifications: NotificationsService,
    @InjectQueue(SCAN_QUEUE) private readonly queue: Queue<{ scanId: string }>,
  ) {}

  async start(user: AuthUser, input: z.infer<typeof StartScanSchema>) {
    let unitId = input.unitId;
    if (!this.access.isOidb(user)) {
      const units = this.access.unitIds(user);
      unitId = unitId ?? units[0];
      if (!unitId) throw conflict('Taramayı başlatmak için bir birime atanmış olmalısınız.');
      this.access.assertUnit(user, unitId);
    }
    const [cap, yd] = await Promise.all([this.rules.active('CAP'), this.rules.active('YANDAL')]);
    const scan = await this.prisma.termScan.create({
      data: { termId: input.termId, unitId, startedBy: user.username, ruleSets: { connect: [{ id: cap.id }, { id: yd.id }] } },
    });
    await this.audit.log({ actor: user.username, action: 'SCAN_START', entity: 'TermScan', entityId: scan.id, after: input });
    await this.queue.add('run', { scanId: scan.id }, { removeOnComplete: 50, attempts: 1 });
    return scan;
  }

  /** Worker tarafından çalıştırılır: her etkin / dondurulmuş kayıt için TERM_END kuralları. */
  async run(scanId: string) {
    const scan = await this.prisma.termScan.update({ where: { id: scanId }, data: { status: 'RUNNING' } });
    try {
      const sets = { CAP: await this.rules.active('CAP'), YANDAL: await this.rules.active('YANDAL') };
      const enrollments = await this.prisma.enrollment.findMany({
        where: {
          status: { in: ['ACTIVE', 'FROZEN'] },
          ...(scan.unitId ? { offering: { program: { unitId: scan.unitId } } } : {}),
        },
        include: { offering: { include: { program: true } } },
      });

      const perStudent = new Map<string, RuleResult[]>();
      const leaves = await this.prisma.termLeave.findMany({ where: { termId: scan.termId, enrollmentId: { in: enrollments.map((e) => e.id) } } });
      for (const e of enrollments) {
        const [student, track] = await Promise.all([this.context.student(e.studentNo, true), this.obis.getTrack(e.studentNo, e.programId)]);
        const out = evaluate(sets[e.type].def, 'TERM_END', {
          student,
          history: {
            mainGano: student.gano,
            trackGpaByTerm: track.gpaByTerm,
            consecutiveTermsWithoutCourse: track.consecutiveTermsWithoutCourse,
            ganoStrikes: e.ganoStrikes,
            onLeave: leaves.some((l) => l.enrollmentId === e.id),
          },
        });

        // KR-ÇAP-12: ana dalda dondurma kendiliğinden uygulanır (talep aranmaz); diğer etkiler birim onayıyla.
        const freeze = out.results.some((r) => r.effects?.freezeEnrollment);
        if (freeze && e.status === 'ACTIVE') {
          await this.prisma.enrollment.update({ where: { id: e.id }, data: { status: 'FROZEN' } });
          await this.audit.log({ actor: 'sistem', action: 'ENROLLMENT_FREEZE', entity: 'Enrollment', entityId: e.id, reason: 'Ana dalda kayıt dondurma (KR-ÇAP-12)' });
        } else if (!freeze && e.status === 'FROZEN' && !student.frozen) {
          await this.prisma.enrollment.update({ where: { id: e.id }, data: { status: 'ACTIVE' } });
          await this.audit.log({ actor: 'sistem', action: 'ENROLLMENT_UNFREEZE', entity: 'Enrollment', entityId: e.id });
        }

        const flagged = out.results.filter((r) => r.status === 'WARN' || r.status === 'FAIL');
        for (const r of flagged) {
          await this.prisma.scanFinding.create({
            data: {
              scanId,
              enrollmentId: e.id,
              ruleCode: r.code,
              status: r.status,
              result: r as unknown as object,
              // Dondurma bilgisi kendiliğinden uygulandığı için onay beklemez.
              decision: r.effects?.freezeEnrollment ? 'CONFIRMED' : 'PENDING',
              decidedBy: r.effects?.freezeEnrollment ? 'sistem' : null,
              decidedAt: r.effects?.freezeEnrollment ? new Date() : null,
            },
          });
        }
        if (flagged.length) perStudent.set(e.studentNo, [...(perStudent.get(e.studentNo) ?? []), ...flagged]);
      }

      // Öğrenciye yalnızca uyarılar e-postayla bildirilir; kayıt silme adayları birim kararından sonra bildirilir.
      for (const [studentNo, results] of perStudent) {
        const warns = results.filter((r) => r.status === 'WARN' && !r.effects?.freezeEnrollment);
        if (!warns.length) continue;
        const info = await this.obis.getStudent(studentNo);
        await this.notifications.emailStudent(info.email, 'Dönem sonu uyarısı', warns.map((r) => `- ${r.title}: ${r.message} (${r.article})`).join('\n'));
      }
      const coordinators = [...new Set(enrollments.map((e) => e.offering.coordinatorUsername))];
      await this.notifications.notifyMany(
        coordinators,
        'Dönem sonu taraması tamamlandı',
        `${enrollments.length} kayıt tarandı, ${perStudent.size} öğrenci için bulgu var.`,
        '/koordinator',
      );
      await this.prisma.termScan.update({ where: { id: scanId }, data: { status: 'DONE', finishedAt: new Date() } });
    } catch (e) {
      this.logger.error(e);
      await this.prisma.termScan.update({ where: { id: scanId }, data: { status: 'FAILED', error: String((e as Error).message), finishedAt: new Date() } });
      throw e;
    }
  }

  list(user: AuthUser, termId?: string) {
    const units = this.access.isOidb(user) ? undefined : this.access.unitIds(user);
    return this.prisma.termScan.findMany({
      where: {
        ...(termId ? { termId } : {}),
        // Birim personeli kendi birimindeki ve tüm birimleri kapsayan taramaları görür (bulgular süzülür).
        ...(units ? { OR: [{ unitId: { in: units } }, { unitId: null }] } : {}),
      },
      include: { term: true, _count: { select: { findings: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async get(user: AuthUser, id: string) {
    const scan = await this.prisma.termScan.findUnique({
      where: { id },
      include: {
        term: true,
        ruleSets: { select: { id: true, version: true, type: true } },
        findings: { include: { enrollment: { include: { offering: { include: { program: true } } } } }, orderBy: [{ status: 'asc' }] },
      },
    });
    if (!scan) throw notFound('Tarama');
    if (scan.unitId) this.access.assertUnit(user, scan.unitId);
    // Tüm birimleri kapsayan taramada birim personeli yalnızca kendi biriminin bulgularını görür.
    const myUnits = this.access.isOidb(user) ? null : this.access.unitIds(user);
    const findings = myUnits
      ? scan.findings.filter((f) => myUnits.includes(f.enrollment.offering.program.unitId))
      : scan.findings;
    const names = new Map<string, string>();
    for (const f of findings) {
      if (!names.has(f.enrollment.studentNo)) {
        const s = await this.obis.getStudent(f.enrollment.studentNo).catch(() => null);
        names.set(f.enrollment.studentNo, s?.fullName ?? f.enrollment.studentNo);
      }
    }
    return {
      ...scan,
      findings: findings.map((f) => ({
        ...f,
        studentNo: f.enrollment.studentNo,
        fullName: names.get(f.enrollment.studentNo),
        programName: f.enrollment.offering.program.name,
        type: f.enrollment.type,
        enrollmentStatus: f.enrollment.status,
      })),
    };
  }

  /** US-23: birim her bulguyu onaylar ya da gerekçeyle reddeder. Kayıt silme yalnızca burada olur. */
  async decide(user: AuthUser, id: string, decision: 'CONFIRMED' | 'DISMISSED', reason: string) {
    const f = await this.prisma.scanFinding.findUnique({
      where: { id },
      include: { scan: true, enrollment: { include: { offering: { include: { program: true } } } } },
    });
    if (!f) throw notFound('Bulgu');
    this.access.assertUnit(user, f.enrollment.offering.program.unitId);
    if (f.decision !== 'PENDING') throw conflict('Bu bulgu için zaten karar verildi.');
    const result = f.result as unknown as RuleResult;

    await this.prisma.$transaction(async (tx) => {
      await tx.scanFinding.update({ where: { id }, data: { decision, reason, decidedBy: user.username, decidedAt: new Date() } });
      if (decision === 'CONFIRMED') {
        if (result.effects?.incrementGanoStrikes) {
          await tx.enrollment.update({ where: { id: f.enrollmentId }, data: { ganoStrikes: { increment: 1 } } });
        }
        if (f.status === 'FAIL' && (f.enrollment.status === 'ACTIVE' || f.enrollment.status === 'FROZEN')) {
          await tx.enrollment.update({ where: { id: f.enrollmentId }, data: { status: 'REMOVED' } });
        }
      }
      await this.audit.log(
        { actor: user.username, action: `FINDING_${decision}`, entity: 'ScanFinding', entityId: id, after: { ruleCode: f.ruleCode, status: f.status }, reason },
        tx,
      );
    });

    if (decision === 'CONFIRMED' && f.status === 'FAIL') {
      const info = await this.obis.getStudent(f.enrollment.studentNo);
      await this.notifications.emailStudent(
        info.email,
        'Kaydınız silindi',
        `${f.enrollment.offering.program.name} ${LABELS.track[f.enrollment.type].toLowerCase()} kaydınız birim kararıyla silindi.\nGerekçe: ${result.title} — ${result.message} (${result.article})\nKarar: ${reason}`,
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
@Roles('BIRIM', 'OIDB')
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @Post('scans')
  start(@CurrentUser() user: AuthUser, @Body(new ZodPipe(StartScanSchema)) body: z.infer<typeof StartScanSchema>) {
    return this.monitoring.start(user, body);
  }

  @Get('scans')
  list(@CurrentUser() user: AuthUser, @Query('termId') termId?: string) {
    return this.monitoring.list(user, termId);
  }

  @Get('scans/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.monitoring.get(user, id);
  }

  @Patch('scan-findings/:id')
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(FindingDecisionSchema)) body: z.infer<typeof FindingDecisionSchema>,
  ) {
    return this.monitoring.decide(user, id, body.decision, body.reason);
  }
}
