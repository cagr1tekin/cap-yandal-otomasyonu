import { Injectable } from '@nestjs/common';
import { evaluate, evaluateRule } from '@cap/rules';
import { LABELS, type LeaveReason } from '@cap/contracts';
import type { Prisma, ProtocolCourse } from '@prisma/client';
import type { AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog.service';
import { conflict, forbidden, notFound, unprocessable } from '../common/http';
import { enrollmentInclude, FormsService, weightedGpa, type EnrollmentCtx } from '../forms/forms.service';
import { TemplatesService } from '../forms/templates';
import { LinkRegistry } from '../integrations/integrations.module';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from '../rules/rules.service';

const listInclude = {
  ...enrollmentInclude,
  findings: { where: { decision: { not: 'DISMISSED' as const } }, orderBy: { scan: { createdAt: 'desc' as const } }, include: { scan: true }, take: 10 },
  protocol: { include: { courses: true } },
  courseRegistrations: true,
} satisfies Prisma.EnrollmentInclude;

type Listed = Prisma.EnrollmentGetPayload<{ include: typeof listInclude }>;

const done = (c: Pick<ProtocolCourse, 'status'>) => c.status === 'PASSED' || c.status === 'EXEMPT';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly links: LinkRegistry,
    private readonly forms: FormsService,
    private readonly templates: TemplatesService,
    private readonly catalog: CatalogService,
  ) {}

  /** Protokol ilerlemesi ve mezuniyet / sertifika kuralı. Ana dal GNO'su son dönem beyanından alınır. */
  private async progress(e: EnrollmentCtx, courses: ProtocolCourse[], mainGano: number, mainGraduated: boolean) {
    const { def } = await this.rules.active(e.type);
    const trackEcts = courses.filter(done).reduce((t, c) => t + c.ects, 0);
    const requiredEcts = courses.reduce((t, c) => t + c.ects, 0);
    const trackGpa = weightedGpa(courses);
    const graduation = evaluate(def, 'GRADUATION', {
      graduation: { mainGraduated, mainGano, trackCompleted: courses.length > 0 && courses.every(done), trackEcts, requiredEcts, trackGpa },
    });
    return { trackEcts, requiredEcts, trackGpa, mainGano, graduation: graduation.results[0] ?? null };
  }

  /** Kayıt ayrıntısı: öğrencinin ve personelin ortak ekranı (protokol, formlar, muafiyet, dönem beyanı, uyarılar). */
  async detail(user: AuthUser, id: string) {
    const e = await this.forms.enrollment(id);
    await this.forms.assertView(user, e);
    const [protocol, regs, exemptions, records, leaves, findings, withdrawals, term, terms, home] = await Promise.all([
      this.prisma.protocol.findUnique({ where: { enrollmentId: id }, include: { courses: { orderBy: { position: 'asc' } }, template: { select: { title: true, source: true } } } }),
      this.prisma.courseRegistration.findMany({ where: { enrollmentId: id }, include: { items: { include: { protocolCourse: { select: { status: true, grade: true, kind: true, name: true } } } }, term: true }, orderBy: { term: { startsAt: 'desc' } } }),
      this.prisma.exemptionRequest.findMany({ where: { enrollmentId: id } }),
      this.prisma.termRecord.findMany({ where: { enrollmentId: id }, include: { term: true }, orderBy: { term: { startsAt: 'desc' } } }),
      this.prisma.termLeave.findMany({ where: { enrollmentId: id }, include: { term: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.scanFinding.findMany({ where: { enrollmentId: id }, include: { scan: { include: { term: true } } }, orderBy: { scan: { createdAt: 'desc' } }, take: 20 }),
      this.prisma.withdrawalRequest.findMany({ where: { enrollmentId: id }, orderBy: { createdAt: 'desc' } }),
      this.catalog.currentTerm(),
      this.prisma.term.findMany({ orderBy: { startsAt: 'asc' } }),
      this.access.home(),
    ]);

    const coord = this.access.isCoordinator(user);
    const owner = this.forms.isOwner(user, e);
    const active = e.status === 'ACTIVE' || e.status === 'FROZEN';
    const approved = protocol?.status === 'APPROVED';
    const template = await this.templates.forStudent(e.type, e.student.programId);
    const check = protocol ? await this.templates.check(e.type, protocol.courses.reduce((t, c) => t + c.ects, 0), protocol.courses.length, protocol.commonEcts, template?.items.reduce((t, i) => t + i.ects, 0) ?? 0) : null;
    const currentReg = regs.find((r) => r.termId === term?.id) ?? null;
    const mainGano = e.mainGraduationGano ?? records[0]?.mainGano ?? e.student.gano;

    return {
      enrollment: {
        id: e.id,
        type: e.type,
        status: e.status,
        statusLabel: LABELS.enrollment[e.status],
        ganoStrikes: e.ganoStrikes,
        startTermId: e.startTermId,
        createdAt: e.createdAt,
        completedAt: e.completedAt,
        mainAdvisorUsername: e.mainAdvisorUsername,
        mainGraduationGano: e.mainGraduationGano,
        program: { id: home.id, name: home.name, faculty: home.faculty },
        offering: { id: e.offeringId, term: e.offering.term },
      },
      student: {
        studentNo: e.studentNo,
        fullName: e.student.fullName,
        email: e.student.email,
        mainProgram: e.student.program.name,
        mainFaculty: e.student.program.faculty,
        mainProgramId: e.student.programId,
      },
      protocol: protocol ? { ...protocol, approvals: await this.forms.approvalsFor('PROTOCOL', protocol.id), results: check?.results ?? [] } : null,
      template: template ? { id: template.id, title: template.title, commonEcts: template.commonEcts, items: template.items, ects: template.items.reduce((t, i) => t + i.ects, 0) } : null,
      courseRegistrations: await Promise.all(regs.map(async (r) => ({ ...r, approvals: await this.forms.approvalsFor('COURSE_REG', r.id) }))),
      registrationOptions: protocol && approved && e.status === 'ACTIVE' ? await this.forms.registrationOptions(protocol.id) : [],
      exemptions: await Promise.all(
        (await this.forms.exemptionOptions(id, protocol)).map(async (o) => ({ ...o, approvals: o.request ? await this.forms.approvalsFor('EXEMPTION', o.request.id) : [] })),
      ),
      termRecords: records,
      leaves,
      findings,
      withdrawals,
      progress: protocol ? await this.progress(e, protocol.courses, mainGano, e.mainGraduationGano !== null) : null,
      currentTerm: term,
      terms,
      advisors: coord ? await this.advisorsOf(e.student.programId) : [],
      links: this.links.all(),
      viewer: { owner, coordinator: coord },
      can: {
        createProtocol: coord && active && (!protocol || protocol.status === 'DRAFT' || protocol.status === 'REJECTED') && !!template,
        submitProtocol: coord && !!protocol && (protocol.status === 'DRAFT' || protocol.status === 'REJECTED'),
        courseRegistration: (owner || coord) && e.status === 'ACTIVE' && approved && !!term && (!currentReg || currentReg.status === 'DRAFT' || currentReg.status === 'REJECTED'),
        exemption: (owner || coord) && active && approved && exemptions.length < 100,
        grades: coord && active && regs.some((r) => r.status === 'APPROVED'),
        termRecord: (owner || coord) && active,
        verifyTermRecord: coord,
        withdraw: (owner || coord) && active,
        leave: coord && active,
        setAdvisor: coord && active,
        complete: coord && active && approved,
      },
    };
  }

  private async advisorsOf(programId: string) {
    const rows = await this.prisma.roleAssignment.findMany({ where: { role: 'DANISMAN', programId }, include: { user: true } });
    return rows.map((r) => ({ username: r.user.username, displayName: r.user.displayName }));
  }

  /** ÇAP'tan ayrılan öğrencinin yan dal sertifikası durumu (ÇAP Yön. m.8/1-g). */
  private async capToMinorOutcome(e: EnrollmentCtx) {
    const pool = await this.templates.forStudent('YANDAL', e.student.programId);
    if (!pool) return { hasMinorProgram: false as const };
    const { def } = await this.rules.active('YANDAL');
    const rule = def.rules.find((r) => r.kind === 'MINOR_PLAN_LIMITS');
    if (!rule) return { hasMinorProgram: false as const };
    const passed = await this.prisma.protocolCourse.findMany({ where: { protocol: { enrollmentId: e.id }, status: { in: ['PASSED', 'EXEMPT'] } } });
    const codes = new Set(passed.map((c) => c.code ?? c.fulfilledCode));
    const inPool = pool.items.filter((i) => i.code && codes.has(i.code));
    const result = evaluateRule(rule, {
      minorPlan: { poolEcts: pool.items.reduce((t, i) => t + i.ects, 0), planEcts: inPool.reduce((t, i) => t + i.ects, 0), planCourseCount: inPool.length },
    });
    return {
      hasMinorProgram: true as const,
      passedPoolCourses: inPool.map((c) => `${c.code} ${c.name}`),
      passedPoolEcts: inPool.reduce((t, i) => t + i.ects, 0),
      eligibleForCertificate: result.status === 'PASS',
      message:
        result.status === 'PASS'
          ? 'Geçilen dersler yan dal gereklerini karşılıyor; öğrenci yan dal sertifikasına hak kazanır (ÇAP Yön. m.8/1-g-1).'
          : 'Geçilen dersler yan dal gereklerini karşılamıyor; eksikleri tamamlamak için döneme bakılmaksızın yan dala kayıt hakkı vardır (ÇAP Yön. m.8/1-g-2).',
    };
  }

  /** Öğrenci kendi isteğiyle ayrılır (ÇAP Yön. m.9/1-a); koordinatör dilekçeyle gelen talebi de işleyebilir. */
  async withdraw(user: AuthUser, id: string, reason: string) {
    const e = await this.forms.enrollment(id);
    if (!this.forms.isOwner(user, e) && !this.access.isCoordinator(user)) throw forbidden();
    if (e.status !== 'ACTIVE' && e.status !== 'FROZEN') throw conflict('Bu kayıttan ayrılma işlenemez.');
    const outcome = e.type === 'CAP' ? await this.capToMinorOutcome(e) : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.enrollment.update({ where: { id }, data: { status: 'WITHDRAWN' } });
      await tx.withdrawalRequest.create({ data: { enrollmentId: id, reason, requestedBy: user.username, capToMinorOutcome: (outcome ?? undefined) as object | undefined } });
      await this.audit.log({ actor: user.username, action: 'ENROLLMENT_WITHDRAW', entity: 'Enrollment', entityId: id, before: { status: e.status }, after: { status: 'WITHDRAWN', outcome }, reason }, tx);
    });
    const track = LABELS.track[e.type].toLowerCase();
    await this.notifications.notify(e.student.user.username, 'Programdan ayrılmanız işlendi', `Bilgisayar Mühendisliği ${track} programından ayrıldınız.${outcome?.hasMinorProgram ? `\n${outcome.message}` : ''}`, `/kayitlar/${id}`);
    await this.notifications.notifyCoordinators('Programdan ayrılma', `${e.student.fullName} (${e.studentNo}) ${track} programından ayrıldı.`, `/kayitlar/${id}`);
    return { ok: true, outcome };
  }

  /** Dönem izni: Erasmus/Farabi, dersin açılmaması, ders çakışması (ÇAP Yön. m.9/1-ç,d). */
  async addLeave(user: AuthUser, id: string, termId: string, reason: LeaveReason, note?: string) {
    await this.forms.enrollment(id);
    const leave = await this.prisma.termLeave.create({ data: { enrollmentId: id, termId, reason, note, createdBy: user.username } });
    await this.audit.log({ actor: user.username, action: 'LEAVE_ADD', entity: 'Enrollment', entityId: id, after: { termId, reason }, reason: note });
    return leave;
  }

  async setAdvisor(user: AuthUser, id: string, username: string | null) {
    const e = await this.forms.enrollment(id);
    if (username) {
      const ok = await this.prisma.roleAssignment.findFirst({ where: { role: 'DANISMAN', programId: e.student.programId, user: { username } } });
      if (!ok) throw unprocessable('Seçilen hesap öğrencinin ana dal bölümünün danışmanı değil.');
    }
    await this.prisma.enrollment.update({ where: { id }, data: { mainAdvisorUsername: username } });
    await this.audit.log({ actor: user.username, action: 'ADVISOR_SET', entity: 'Enrollment', entityId: id, before: { mainAdvisorUsername: e.mainAdvisorUsername }, after: { mainAdvisorUsername: username } });
    return { ok: true };
  }

  /**
   * Dönem sonu beyanı: öğrenci ana dal GNO'sunu ve kayıt dondurma durumunu girer; koordinatör transkriptle
   * doğrular. Dönem sonu taraması bu beyanı kullanır (OBİS bağlantısı yoktur, K-12).
   */
  async saveTermRecord(user: AuthUser, id: string, input: { termId: string; mainGano: number; mainFrozen: boolean }) {
    const e = await this.forms.enrollment(id);
    const coord = this.access.isCoordinator(user);
    if (!this.forms.isOwner(user, e) && !coord) throw forbidden();
    if (e.status !== 'ACTIVE' && e.status !== 'FROZEN') throw conflict('Yalnızca etkin kayıtlar için dönem beyanı girilir.');
    const term = await this.prisma.term.findUnique({ where: { id: input.termId } });
    if (!term) throw notFound('Dönem');
    if (term.startsAt > new Date()) throw conflict('Henüz başlamamış bir dönem için beyan girilemez.');
    if (term.startsAt < e.offering.term.startsAt) throw conflict('Kayıttan önceki bir dönem için beyan girilemez.');
    const existing = await this.prisma.termRecord.findUnique({ where: { enrollmentId_termId: { enrollmentId: id, termId: input.termId } } });
    if (existing?.verifiedAt && !coord) throw conflict('Doğrulanmış dönem beyanı değiştirilemez; düzeltme için koordinatöre başvurun.');
    const data = { mainGano: input.mainGano, mainFrozen: input.mainFrozen, declaredBy: user.username, declaredAt: new Date(), verifiedBy: coord ? user.username : null, verifiedAt: coord ? new Date() : null };
    const rec = existing ? await this.prisma.termRecord.update({ where: { id: existing.id }, data }) : await this.prisma.termRecord.create({ data: { enrollmentId: id, termId: input.termId, ...data } });
    await this.audit.log({ actor: user.username, action: 'TERM_RECORD_SAVE', entity: 'Enrollment', entityId: id, before: existing ? { mainGano: existing.mainGano } : undefined, after: { termId: input.termId, mainGano: input.mainGano, mainFrozen: input.mainFrozen } });
    return rec;
  }

  async verifyTermRecord(user: AuthUser, recordId: string) {
    const rec = await this.prisma.termRecord.findUnique({ where: { id: recordId } });
    if (!rec) throw notFound('Dönem beyanı');
    if (rec.verifiedAt) throw conflict('Beyan zaten doğrulandı.');
    await this.prisma.termRecord.update({ where: { id: recordId }, data: { verifiedBy: user.username, verifiedAt: new Date() } });
    await this.audit.log({ actor: user.username, action: 'TERM_RECORD_VERIFY', entity: 'Enrollment', entityId: rec.enrollmentId, after: { termId: rec.termId, mainGano: rec.mainGano } });
    return { ok: true };
  }

  /** Mezuniyet denetimi: ana daldan mezuniyet GNO'su girilir, kural sağlanıyorsa kayıt tamamlanır. */
  async complete(user: AuthUser, id: string, mainGano: number) {
    const e = await this.forms.enrollment(id);
    if (e.status !== 'ACTIVE' && e.status !== 'FROZEN') throw conflict('Yalnızca etkin kayıtlar tamamlanır.');
    const courses = await this.prisma.protocolCourse.findMany({ where: { protocol: { enrollmentId: id, status: 'APPROVED' } } });
    const p = await this.progress(e, courses, mainGano, true);
    if (p.graduation?.status !== 'PASS') throw unprocessable('Mezuniyet koşulları sağlanmıyor.', { results: p.graduation ? [p.graduation] : [] });
    await this.prisma.enrollment.update({ where: { id }, data: { status: 'COMPLETED', mainGraduationGano: mainGano, completedAt: new Date() } });
    await this.audit.log({ actor: user.username, action: 'ENROLLMENT_COMPLETE', entity: 'Enrollment', entityId: id, after: { mainGano, trackEcts: p.trackEcts, trackGpa: p.trackGpa } });
    await this.notifications.notify(e.student.user.username, e.type === 'CAP' ? 'Çift ana dal programını tamamladınız' : 'Yan dal programını tamamladınız', p.graduation.message, `/kayitlar/${id}`);
    return { ok: true, graduation: p.graduation };
  }

  private shape(e: Listed, termId?: string) {
    const courses = e.protocol?.courses ?? [];
    return {
      id: e.id,
      studentNo: e.studentNo,
      fullName: e.student.fullName,
      mainProgramName: e.student.program.name,
      type: e.type,
      status: e.status,
      statusLabel: LABELS.enrollment[e.status],
      ganoStrikes: e.ganoStrikes,
      createdAt: e.createdAt,
      term: e.offering.term,
      protocolStatus: e.protocol?.status ?? null,
      currentRegistrationStatus: e.courseRegistrations.find((r) => r.termId === termId)?.status ?? null,
      trackEcts: courses.filter(done).reduce((t, c) => t + c.ects, 0),
      requiredEcts: courses.reduce((t, c) => t + c.ects, 0),
      warnings: e.findings.map((f) => ({ id: f.id, ruleCode: f.ruleCode, status: f.status, decision: f.decision, result: f.result, at: f.scan.createdAt })),
    };
  }

  /** Komisyon ve bölüm başkanı: bölümün bütün ÇAP / yan dal öğrencileri. */
  async list(f: { type?: string; status?: string; q?: string }) {
    const term = await this.catalog.currentTerm();
    const rows = await this.prisma.enrollment.findMany({
      where: {
        ...(f.type ? { type: f.type as 'CAP' | 'YANDAL' } : {}),
        ...(f.status ? { status: f.status as 'ACTIVE' } : {}),
        ...(f.q ? { OR: [{ studentNo: { startsWith: f.q } }, { student: { fullName: { contains: f.q, mode: 'insensitive' } } }] } : {}),
      },
      include: listInclude,
      orderBy: [{ status: 'asc' }, { studentNo: 'asc' }],
    });
    return { currentTerm: term, items: rows.map((e) => this.shape(e, term?.id)) };
  }

  async mine(user: AuthUser) {
    if (!user.studentNo) return [];
    const term = await this.catalog.currentTerm();
    const rows = await this.prisma.enrollment.findMany({ where: { studentNo: user.studentNo }, include: listInclude, orderBy: { createdAt: 'desc' } });
    return rows.map((e) => this.shape(e, term?.id));
  }

  /** Ana dal danışmanı ve ana dal bölüm başkanı: kendi bölümünün öğrencileri (yalnızca okuma + imza). */
  async forMainDepartment(user: AuthUser) {
    const heads = this.access.headProgramIds(user);
    const term = await this.catalog.currentTerm();
    const rows = await this.prisma.enrollment.findMany({
      where: { OR: [{ mainAdvisorUsername: user.username }, { student: { advisorUsername: user.username } }, ...(heads.length ? [{ student: { programId: { in: heads } } }] : [])] },
      include: listInclude,
      orderBy: [{ status: 'asc' }, { studentNo: 'asc' }],
    });
    return { currentTerm: term, items: rows.map((e) => this.shape(e, term?.id)) };
  }
}
