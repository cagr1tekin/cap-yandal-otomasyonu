import { Injectable } from '@nestjs/common';
import { evaluate, evaluateRule } from '@cap/rules';
import { LABELS } from '@cap/contracts';
import type { Enrollment, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { offeringInclude } from '../catalog/catalog.service';
import { conflict, forbidden, notFound, unprocessable } from '../common/http';
import { LinkRegistry } from '../integrations/integrations.module';
import { ObisPort, type ObisTrack } from '../integrations/obis.port';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from '../rules/rules.service';

const enrollmentInclude = {
  offering: { include: offeringInclude },
  planItems: { include: { poolCourse: true } },
  findings: { orderBy: { scan: { createdAt: 'desc' as const } }, include: { scan: true }, take: 20 },
  withdrawals: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.EnrollmentInclude;

type EnrollmentFull = Prisma.EnrollmentGetPayload<{ include: typeof enrollmentInclude }>;

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly obis: ObisPort,
    private readonly rules: RulesService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly links: LinkRegistry,
  ) {}

  private requiredEcts(e: EnrollmentFull) {
    return e.type === 'CAP' ? e.offering.program.durationYears * 60 : 30;
  }

  /** Bir kaydın ilerleme özeti: OBİS'ten program dersleri + mezuniyet/sertifika kuralı. */
  private async progress(e: EnrollmentFull) {
    const [track, standing, { def }] = await Promise.all([
      this.obis.getTrack(e.studentNo, e.programId),
      this.obis.getStanding(e.studentNo),
      this.rules.active(e.type),
    ]);
    const passed = track.results.filter((r) => r.passed);
    const trackEcts = passed.reduce((t, r) => t + r.ects, 0);
    const required = this.requiredEcts(e);
    const planApproved = e.planItems.length > 0 && e.planItems.every((p) => p.status === 'APPROVED');
    const trackCompleted =
      e.type === 'CAP'
        ? trackEcts >= required
        : planApproved && e.planItems.every((p) => passed.some((r) => r.code === p.poolCourse.courseCode));
    const graduation = evaluate(def, 'GRADUATION', {
      graduation: {
        mainGraduated: standing.mainGraduated,
        mainGano: standing.gano,
        trackCompleted,
        trackEcts,
        requiredEcts: required,
        trackGpa: track.gpaByTerm.at(-1) ?? null,
      },
    });
    return {
      trackEcts,
      requiredEcts: required,
      trackGpa: track.gpaByTerm.at(-1) ?? null,
      mainGano: standing.gano,
      courses: track.results,
      graduation: graduation.results[0] ?? null,
    };
  }

  private shape(e: EnrollmentFull) {
    return {
      id: e.id,
      studentNo: e.studentNo,
      type: e.type,
      status: e.status,
      statusLabel: LABELS.enrollment[e.status],
      ganoStrikes: e.ganoStrikes,
      startTerm: e.startTermId,
      createdAt: e.createdAt,
      program: { id: e.programId, name: e.offering.program.name, unitName: e.offering.program.unit.name },
      coordinatorUsername: e.offering.coordinatorUsername,
      pool: e.offering.poolCourses,
      plan: e.planItems.map((p) => ({ id: p.id, status: p.status, approvedBy: p.approvedBy, course: p.poolCourse })),
      warnings: e.findings
        .filter((f) => f.decision !== 'DISMISSED')
        .map((f) => ({ id: f.id, ruleCode: f.ruleCode, status: f.status, decision: f.decision, result: f.result, at: f.scan.createdAt })),
      withdrawals: e.withdrawals,
    };
  }

  async mine(studentNo: string) {
    const rows = await this.prisma.enrollment.findMany({
      where: { studentNo },
      include: enrollmentInclude,
      orderBy: { createdAt: 'desc' },
    });
    const items = [];
    for (const e of rows) {
      items.push({ ...this.shape(e), progress: e.status === 'ACTIVE' || e.status === 'FROZEN' ? await this.progress(e) : null });
    }
    return { items, links: this.links.all() };
  }

  private async own(studentNo: string, id: string) {
    const e = await this.prisma.enrollment.findFirst({ where: { id, studentNo }, include: enrollmentInclude });
    if (!e) throw notFound('Kayıt');
    return e;
  }

  /** US-04: yan dal ders planı (KR-YD-05). */
  async savePlan(studentNo: string, id: string, poolCourseIds: string[]) {
    const e = await this.own(studentNo, id);
    if (e.type !== 'YANDAL') throw conflict('Ders planı yalnızca yan dal kayıtları için girilir.');
    if (e.status !== 'ACTIVE') throw conflict('Yalnızca etkin kayıtlar için plan girilebilir.');
    const pool = e.offering.poolCourses;
    const chosen = pool.filter((c) => poolCourseIds.includes(c.id));
    if (chosen.length !== new Set(poolCourseIds).size) throw unprocessable('Seçilen derslerden bazıları havuzda yok.');

    const { def } = await this.rules.active('YANDAL');
    const rule = def.rules.find((r) => r.kind === 'MINOR_PLAN_LIMITS')!;
    const result = evaluateRule(rule, {
      minorPlan: {
        poolEcts: pool.reduce((t, c) => t + c.ects, 0),
        planEcts: chosen.reduce((t, c) => t + c.ects, 0),
        planCourseCount: chosen.length,
      },
    });
    if (result.status === 'FAIL') throw unprocessable(result.message, { results: [result] });

    await this.prisma.$transaction(async (tx) => {
      await tx.minorPlanItem.deleteMany({ where: { enrollmentId: id } });
      await tx.minorPlanItem.createMany({ data: chosen.map((c) => ({ enrollmentId: id, poolCourseId: c.id })) });
      await this.audit.log({ actor: studentNo, action: 'MINOR_PLAN_SAVE', entity: 'Enrollment', entityId: id, after: chosen.map((c) => c.courseCode) }, tx);
    });
    await this.notifications.notify(
      e.offering.coordinatorUsername,
      'Yan dal planı onay bekliyor',
      `${studentNo} numaralı öğrenci ${e.offering.program.name} yan dal planını gönderdi (${chosen.length} ders).`,
      `/koordinator/${e.offeringId}/ogrenciler`,
    );
    return { ok: true, result };
  }

  async approvePlan(user: AuthUser, id: string) {
    const e = await this.prisma.enrollment.findUnique({ where: { id }, include: enrollmentInclude });
    if (!e) throw notFound('Kayıt');
    this.access.assertOffering(user, e.offering, ['KOORDINATOR', 'OIDB']);
    if (!e.planItems.length) throw conflict('Onaylanacak plan yok.');
    await this.prisma.minorPlanItem.updateMany({ where: { enrollmentId: id }, data: { status: 'APPROVED', approvedBy: user.username } });
    await this.audit.log({ actor: user.username, action: 'MINOR_PLAN_APPROVE', entity: 'Enrollment', entityId: id });
    await this.notifications.notify(
      e.studentNo,
      'Yan dal planınız onaylandı',
      'Planınızdaki derslere OBİS\'ten ders kaydı yapabilirsiniz.',
      '/ogrenci/programlarim',
    );
    return { ok: true };
  }

  /** KR-ÇAP-17: ÇAP'tan ayrılan öğrencinin aynı programın yan dalı için durumu. */
  private async capToMinorOutcome(e: Enrollment, track: ObisTrack) {
    const minor = await this.prisma.offering.findFirst({
      where: { programId: e.programId, type: 'YANDAL' },
      include: { poolCourses: true, term: true },
      orderBy: { term: { startsAt: 'desc' } },
    });
    if (!minor) return { hasMinorProgram: false as const };
    const { def } = await this.rules.active('YANDAL');
    const rule = def.rules.find((r) => r.kind === 'MINOR_PLAN_LIMITS')!;
    const passedPool = minor.poolCourses.filter((c) => track.results.some((r) => r.passed && r.code === c.courseCode));
    const result = evaluateRule(rule, {
      minorPlan: {
        poolEcts: minor.poolCourses.reduce((t, c) => t + c.ects, 0),
        planEcts: passedPool.reduce((t, c) => t + c.ects, 0),
        planCourseCount: passedPool.length,
      },
    });
    return {
      hasMinorProgram: true as const,
      minorOfferingId: minor.id,
      passedPoolCourses: passedPool.map((c) => `${c.courseCode} ${c.name}`),
      passedPoolEcts: passedPool.reduce((t, c) => t + c.ects, 0),
      eligibleForCertificate: result.status === 'PASS',
      eligibleForMinorEnrollment: result.status !== 'PASS',
      message:
        result.status === 'PASS'
          ? 'Aldığınız dersler yan dal gereklerini karşılıyor; yan dal sertifikasına hak kazanırsınız (ÇAP Yön. m.8/1-g-1).'
          : 'Aldığınız dersler yan dal gereklerini karşılamıyor; eksikleri tamamlamak için döneminize bakılmaksızın yan dala kayıt hakkınız var (ÇAP Yön. m.8/1-g-2).',
    };
  }

  /** US-06: kendi isteğiyle ayrılma. */
  async withdraw(studentNo: string, id: string, reason: string) {
    const e = await this.own(studentNo, id);
    if (e.status !== 'ACTIVE' && e.status !== 'FROZEN') throw conflict('Bu kayıttan ayrılma yapılamaz.');
    const track = await this.obis.getTrack(studentNo, e.programId);
    const outcome = e.type === 'CAP' ? await this.capToMinorOutcome(e, track) : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.update({ where: { id }, data: { status: 'WITHDRAWN' } });
      await tx.withdrawalRequest.create({ data: { enrollmentId: id, reason, capToMinorOutcome: (outcome ?? undefined) as object | undefined } });
      await this.audit.log({ actor: studentNo, action: 'ENROLLMENT_WITHDRAW', entity: 'Enrollment', entityId: id, before: { status: e.status }, after: { status: 'WITHDRAWN', outcome }, reason }, tx);
    });
    const unitStaff = await this.prisma.roleAssignment.findMany({
      where: { role: 'BIRIM', unitId: e.offering.program.unitId },
      include: { user: true },
    });
    await this.notifications.notifyMany(
      [e.offering.coordinatorUsername, ...unitStaff.map((u) => u.user.username)],
      'Programdan ayrılma',
      `${studentNo} numaralı öğrenci ${e.offering.program.name} ${LABELS.track[e.type].toLowerCase()} programından ayrıldı.${outcome?.hasMinorProgram ? ` ${outcome.message}` : ''}`,
      `/koordinator/${e.offeringId}/ogrenciler`,
    );
    return { ok: true, outcome, links: this.links.all().filter((l) => l.key === 'birim-muafiyet') };
  }

  /** US-12: koordinatörün kayıtlı öğrencileri. */
  async forOffering(user: AuthUser, offeringId: string) {
    const o = await this.prisma.offering.findUnique({ where: { id: offeringId }, include: offeringInclude });
    if (!o) throw notFound('Program teklifi');
    this.access.assertOffering(user, o, ['KOORDINATOR', 'BOLUM_BASKANI', 'BIRIM', 'OIDB']);
    // Aynı programın tüm dönemlerdeki teklifleri: koordinatör programdaki herkesi izler.
    const rows = await this.prisma.enrollment.findMany({
      where: { programId: o.programId, type: o.type },
      include: enrollmentInclude,
      orderBy: [{ status: 'asc' }, { studentNo: 'asc' }],
    });
    const items = [];
    for (const e of rows) {
      const student = await this.obis.getStudent(e.studentNo).catch(() => null);
      items.push({ ...this.shape(e), fullName: student?.fullName ?? e.studentNo });
    }
    return { offering: o, items };
  }

  /** Danışman: danışmanı olduğu öğrencilerin ÇAP / yan dal durumu (yalnızca okuma). */
  async forAdvisor(user: AuthUser) {
    if (!user.roles.includes('DANISMAN')) throw forbidden();
    const studentNos = await this.obis.getAdvisees(user.username);
    const [enrollments, apps] = await Promise.all([
      this.prisma.enrollment.findMany({ where: { studentNo: { in: studentNos } }, include: enrollmentInclude }),
      this.prisma.application.findMany({ where: { studentNo: { in: studentNos } }, include: { offering: { include: offeringInclude } } }),
    ]);
    const result = [];
    for (const no of studentNos) {
      const s = await this.obis.getStudent(no);
      const standing = await this.obis.getStanding(no);
      result.push({
        studentNo: no,
        fullName: s.fullName,
        gano: standing.gano,
        semesterNo: standing.semesterNo,
        enrollments: enrollments.filter((e) => e.studentNo === no).map((e) => this.shape(e)),
        applications: apps
          .filter((a) => a.studentNo === no)
          .map((a) => ({ id: a.id, status: a.status, programName: a.offering.program.name, type: a.offering.type })),
      });
    }
    return result;
  }
}
