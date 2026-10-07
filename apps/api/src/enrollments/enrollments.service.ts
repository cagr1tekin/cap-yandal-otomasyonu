import { Injectable } from '@nestjs/common';
import { evaluate, evaluateRule } from '@cap/rules';
import { LABELS, type LeaveReason } from '@cap/contracts';
import type { Enrollment, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService, offeringInclude } from '../catalog/catalog.service';
import { conflict, forbidden, notFound } from '../common/http';
import { FormsService, type EnrollmentCtx } from '../forms/forms.service';
import { LinkRegistry } from '../integrations/integrations.module';
import { ObisPort, type ObisTrack } from '../integrations/obis.port';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from '../rules/rules.service';

const listInclude = {
  offering: { include: offeringInclude },
  findings: { where: { decision: { not: 'DISMISSED' as const } }, orderBy: { scan: { createdAt: 'desc' as const } }, include: { scan: true }, take: 10 },
  protocol: true,
  courseRegistrations: true,
} satisfies Prisma.EnrollmentInclude;

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
    private readonly forms: FormsService,
    private readonly catalog: CatalogService,
  ) {}

  private requiredEcts(e: EnrollmentCtx) {
    return e.type === 'CAP' ? e.offering.program.durationYears * 60 : 30;
  }

  /** OBİS'ten program dersleri + mezuniyet/sertifika kuralı. */
  private async progress(e: EnrollmentCtx, protocolCodes: string[]) {
    const [track, standing, { def }] = await Promise.all([
      this.obis.getTrack(e.studentNo, e.programId),
      this.obis.getStanding(e.studentNo),
      this.rules.active(e.type),
    ]);
    const passed = track.results.filter((r) => r.passed);
    const trackEcts = passed.reduce((t, r) => t + r.ects, 0);
    const required = this.requiredEcts(e);
    const trackCompleted =
      e.type === 'CAP' ? trackEcts >= required : protocolCodes.length > 0 && protocolCodes.every((c) => passed.some((r) => r.code === c));
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
      semesterNo: standing.semesterNo,
      courses: track.results,
      graduation: graduation.results[0] ?? null,
    };
  }

  /** Kayıt ayrıntısı: personelin tek ekranı (protokol, ders kayıtları, izinler, uyarılar, ilerleme). */
  async detail(user: AuthUser, id: string) {
    const e = await this.forms.enrollment(id);
    await this.forms.assertView(user, e);
    const [student, protocol, regs, leaves, findings, withdrawals, term, terms] = await Promise.all([
      this.obis.getStudent(e.studentNo),
      this.prisma.protocol.findUnique({ where: { enrollmentId: id }, include: { courses: { orderBy: { code: 'asc' } } } }),
      this.prisma.courseRegistration.findMany({ where: { enrollmentId: id }, include: { items: true }, orderBy: { termId: 'desc' } }),
      this.prisma.termLeave.findMany({ where: { enrollmentId: id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.scanFinding.findMany({ where: { enrollmentId: id }, include: { scan: true }, orderBy: { scan: { createdAt: 'desc' } }, take: 20 }),
      this.prisma.withdrawalRequest.findMany({ where: { enrollmentId: id }, orderBy: { createdAt: 'desc' } }),
      this.catalog.currentTerm(),
      this.prisma.term.findMany({ orderBy: { startsAt: 'asc' } }),
    ]);
    const mainProgram = await this.prisma.program.findUnique({ where: { id: student.programId }, include: { unit: true } });
    const options = await this.forms.protocolOptions(e);
    const evaluation = protocol ? await this.forms.evaluateProtocol(e, protocol.courses.map((c) => c.code)) : null;
    const window = term ? await this.catalog.window(e.offering.program.unitId, term.id, e.type) : null;

    const isCoord = this.access.canOnOffering(user, e.offering, ['KOORDINATOR', 'OIDB']);
    const isUnit = this.access.canOnOffering(user, e.offering, ['BIRIM', 'OIDB']);
    const active = e.status === 'ACTIVE' || e.status === 'FROZEN';
    return {
      enrollment: {
        id: e.id,
        type: e.type,
        status: e.status,
        statusLabel: LABELS.enrollment[e.status],
        ganoStrikes: e.ganoStrikes,
        startTermId: e.startTermId,
        createdAt: e.createdAt,
        registeredBy: e.registeredBy,
        registrationDocuments: e.registrationDocuments,
        trackAdvisorUsername: e.trackAdvisorUsername,
        coordinatorUsername: e.offering.coordinatorUsername,
        program: { id: e.programId, name: e.offering.program.name, unitName: e.offering.program.unit.name },
      },
      student: { studentNo: e.studentNo, fullName: student.fullName, email: student.email, advisorUsername: student.advisorUsername, mainProgram: mainProgram?.name, mainUnit: mainProgram?.unit.name },
      protocol: protocol
        ? { ...protocol, approvals: await this.forms.approvalsFor('PROTOCOL', protocol.id), results: evaluation?.results ?? [] }
        : null,
      protocolOptions: { courses: options.courses, commonCourses: options.commonCourses, commonEcts: options.commonEcts, poolEcts: options.poolEcts },
      courseRegistrations: await Promise.all(regs.map(async (r) => ({ ...r, approvals: await this.forms.approvalsFor('COURSE_REG', r.id) }))),
      leaves,
      findings,
      withdrawals,
      progress: active ? await this.progress(e, protocol?.courses.map((c) => c.code) ?? []) : null,
      currentTerm: term,
      terms,
      window,
      links: this.links.all(),
      can: {
        editProtocol: isCoord && active,
        fileProtocol: isUnit && protocol?.status === 'APPROVED',
        courseRegistration: isCoord && e.status === 'ACTIVE' && !!protocol && ['APPROVED', 'FILED'].includes(protocol.status),
        withdraw: isUnit && active,
        leave: isUnit && active,
        setTrackAdvisor: active && (this.access.isOidb(user) || this.access.isHeadOf(user, e.programId) || isUnit),
      },
    };
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
          ? 'Alınan dersler yan dal gereklerini karşılıyor; öğrenci yan dal sertifikasına hak kazanır (ÇAP Yön. m.8/1-g-1).'
          : 'Alınan dersler yan dal gereklerini karşılamıyor; eksikleri tamamlamak için döneme bakılmaksızın yan dala kayıt hakkı var (ÇAP Yön. m.8/1-g-2).',
    };
  }

  /** Öğrencinin dilekçesiyle birimin işlediği ayrılma (Yönerge m.9/a). */
  async withdraw(user: AuthUser, id: string, reason: string) {
    const e = await this.forms.enrollment(id);
    this.access.assertOffering(user, e.offering, ['BIRIM', 'OIDB']);
    if (e.status !== 'ACTIVE' && e.status !== 'FROZEN') throw conflict('Bu kayıttan ayrılma işlenemez.');
    const track = await this.obis.getTrack(e.studentNo, e.programId);
    const outcome = e.type === 'CAP' ? await this.capToMinorOutcome(e, track) : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.update({ where: { id }, data: { status: 'WITHDRAWN' } });
      await tx.withdrawalRequest.create({ data: { enrollmentId: id, reason, capToMinorOutcome: (outcome ?? undefined) as object | undefined } });
      await this.audit.log({ actor: user.username, action: 'ENROLLMENT_WITHDRAW', entity: 'Enrollment', entityId: id, before: { status: e.status }, after: { status: 'WITHDRAWN', outcome }, reason }, tx);
    });
    const s = await this.obis.getStudent(e.studentNo);
    await this.notifications.emailStudent(
      s.email,
      'Programdan ayrılmanız işlendi',
      `${e.offering.program.name} ${LABELS.track[e.type].toLowerCase()} programından ayrılma talebiniz işlendi.${outcome?.hasMinorProgram ? `\n${outcome.message}` : ''}\nDerslerin ana dalda sayılması için dilekçeyle birime başvurabilirsiniz.`,
    );
    await this.notifications.notify(
      e.offering.coordinatorUsername,
      'Programdan ayrılma',
      `${e.studentNo} numaralı öğrenci ${e.offering.program.name} ${LABELS.track[e.type].toLowerCase()} programından ayrıldı.`,
      `/kayitlar/${id}`,
    );
    return { ok: true, outcome };
  }

  /** Dönem izni: Erasmus/Farabi, dersin açılmaması, ders çakışması (Yönerge m.9/ç; İİBF ilkeleri). */
  async addLeave(user: AuthUser, id: string, termId: string, reason: LeaveReason, note?: string) {
    const e = await this.forms.enrollment(id);
    this.access.assertOffering(user, e.offering, ['BIRIM', 'OIDB']);
    const leave = await this.prisma.termLeave.create({ data: { enrollmentId: id, termId, reason, note, createdBy: user.username } });
    await this.audit.log({ actor: user.username, action: 'LEAVE_ADD', entity: 'Enrollment', entityId: id, after: { termId, reason }, reason: note });
    return leave;
  }

  async setTrackAdvisor(user: AuthUser, id: string, username: string) {
    const e = await this.forms.enrollment(id);
    const ok = this.access.isOidb(user) || this.access.isHeadOf(user, e.programId) || this.access.canOnOffering(user, e.offering, ['BIRIM']);
    if (!ok) throw forbidden();
    const target = await this.prisma.user.findUnique({ where: { username } });
    if (!target) throw notFound('Kullanıcı');
    await this.prisma.enrollment.update({ where: { id }, data: { trackAdvisorUsername: username } });
    await this.audit.log({ actor: user.username, action: 'TRACK_ADVISOR_SET', entity: 'Enrollment', entityId: id, before: { trackAdvisorUsername: e.trackAdvisorUsername }, after: { trackAdvisorUsername: username } });
    return { ok: true };
  }

  private shape(e: Prisma.EnrollmentGetPayload<{ include: typeof listInclude }>, termId?: string) {
    return {
      id: e.id,
      studentNo: e.studentNo,
      type: e.type,
      status: e.status,
      statusLabel: LABELS.enrollment[e.status],
      ganoStrikes: e.ganoStrikes,
      createdAt: e.createdAt,
      program: { id: e.programId, name: e.offering.program.name, unitName: e.offering.program.unit.name },
      protocolStatus: e.protocol?.status ?? null,
      currentRegistrationStatus: e.courseRegistrations.find((r) => r.termId === termId)?.status ?? null,
      warnings: e.findings.map((f) => ({ id: f.id, ruleCode: f.ruleCode, status: f.status, decision: f.decision, result: f.result, at: f.scan.createdAt })),
    };
  }

  /** Koordinatör / bölüm / birim: programdaki kayıtlı öğrenciler. */
  async forOffering(user: AuthUser, offeringId: string) {
    const o = await this.prisma.offering.findUnique({ where: { id: offeringId }, include: offeringInclude });
    if (!o) throw notFound('Program teklifi');
    this.access.assertOffering(user, o, ['KOORDINATOR', 'BOLUM_BASKANI', 'BIRIM', 'OIDB']);
    const term = await this.catalog.currentTerm();
    const rows = await this.prisma.enrollment.findMany({
      where: { programId: o.programId, type: o.type },
      include: listInclude,
      orderBy: [{ status: 'asc' }, { studentNo: 'asc' }],
    });
    const items = [];
    for (const e of rows) {
      const student = await this.obis.getStudent(e.studentNo).catch(() => null);
      items.push({ ...this.shape(e, term?.id), fullName: student?.fullName ?? e.studentNo });
    }
    return { offering: o, currentTerm: term, items };
  }

  /** Danışman: ana dal danışmanı olduğu öğrenciler ve ÇAP/yan dal danışmanı olduğu kayıtlar (yalnızca okuma). */
  async forAdvisor(user: AuthUser) {
    if (!user.roles.includes('DANISMAN') && !user.roles.includes('KOORDINATOR')) throw forbidden();
    const studentNos = await this.obis.getAdvisees(user.username);
    const term = await this.catalog.currentTerm();
    const [enrollments, apps] = await Promise.all([
      this.prisma.enrollment.findMany({
        where: { OR: [{ studentNo: { in: studentNos } }, { trackAdvisorUsername: user.username }] },
        include: listInclude,
      }),
      this.prisma.application.findMany({ where: { studentNo: { in: studentNos } }, include: { offering: { include: offeringInclude } } }),
    ]);
    const all = [...new Set([...studentNos, ...enrollments.map((e) => e.studentNo)])];
    const result = [];
    for (const no of all) {
      const [s, standing] = await Promise.all([this.obis.getStudent(no), this.obis.getStanding(no)]);
      result.push({
        studentNo: no,
        fullName: s.fullName,
        gano: standing.gano,
        semesterNo: standing.semesterNo,
        relation: studentNos.includes(no) ? 'ANA_DAL' : 'PROGRAM',
        enrollments: enrollments.filter((e) => e.studentNo === no).map((e) => this.shape(e, term?.id)),
        applications: apps
          .filter((a) => a.studentNo === no)
          .map((a) => ({ id: a.id, status: a.status, programName: a.offering.program.name, type: a.offering.type })),
      });
    }
    return result;
  }
}
