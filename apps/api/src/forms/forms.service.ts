import { Injectable } from '@nestjs/common';
import { evaluate, type RuleResult } from '@cap/rules';
import { LABELS, type ApprovalRole, type TrackType } from '@cap/contracts';
import type { ApprovalSubject, Enrollment, FormStatus, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { offeringInclude, type OfferingFull } from '../catalog/catalog.service';
import { conflict, forbidden, notFound, unprocessable } from '../common/http';
import { ObisPort } from '../integrations/obis.port';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from '../rules/rules.service';

/** İmzacılar: Kabul ve Ders Protokol Formu (5 imza) ve ders kayıt formları (Esaslar m.3–4). */
const PROTOCOL_SIGNERS: ApprovalRole[] = ['OGRENCI_IMZA', 'ANA_DAL_DANISMANI', 'ANA_DAL_BOLUM_BASKANI', 'KOORDINATOR', 'HEDEF_BOLUM_BASKANI'];
const COURSE_REG_SIGNERS: Record<TrackType, ApprovalRole[]> = {
  // ÇAP Esasları m.4: danışman + koordinatör imzalar, "her iki bölüm başkanı tarafından da onaylanır".
  CAP: ['OGRENCI_IMZA', 'ANA_DAL_DANISMANI', 'KOORDINATOR', 'ANA_DAL_BOLUM_BASKANI', 'HEDEF_BOLUM_BASKANI'],
  // Yan Dal Ders Kayıt Formu: öğrenci, ana dal danışmanı, yan dal koordinatörü.
  YANDAL: ['OGRENCI_IMZA', 'ANA_DAL_DANISMANI', 'KOORDINATOR'],
};

const EDITABLE: FormStatus[] = ['DRAFT', 'REJECTED'];

export type EnrollmentCtx = Enrollment & { offering: OfferingFull };

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly obis: ObisPort,
    private readonly rules: RulesService,
    private readonly notifications: NotificationsService,
  ) {}

  async enrollment(id: string): Promise<EnrollmentCtx> {
    const e = await this.prisma.enrollment.findUnique({ where: { id }, include: { offering: { include: offeringInclude } } });
    if (!e) throw notFound('Kayıt');
    return e;
  }

  /** Kayıtla ilgili kişiler: hedef program personeli, ana dal bölüm başkanı, ana dal danışmanı, birim, ÖİDB. */
  async canView(user: AuthUser, e: EnrollmentCtx) {
    if (this.access.canOnOffering(user, e.offering, ['KOORDINATOR', 'BOLUM_BASKANI', 'BIRIM', 'OIDB'])) return true;
    if (e.trackAdvisorUsername === user.username) return true;
    const s = await this.obis.getStudent(e.studentNo);
    return s.advisorUsername === user.username || this.access.isHeadOf(user, s.programId);
  }

  async assertView(user: AuthUser, e: EnrollmentCtx) {
    if (!(await this.canView(user, e))) throw forbidden('Bu kayda erişim yetkiniz yok.');
  }

  private async headOf(programId: string) {
    const a = await this.prisma.roleAssignment.findFirst({ where: { role: 'BOLUM_BASKANI', programId }, include: { user: true } });
    return a?.user.username ?? null;
  }

  /** Her imzacı rolü için onaylayacak kişi. */
  private async assignees(e: EnrollmentCtx): Promise<Record<ApprovalRole, string | null>> {
    const s = await this.obis.getStudent(e.studentNo);
    return {
      OGRENCI_IMZA: e.offering.coordinatorUsername,
      ANA_DAL_DANISMANI: s.advisorUsername,
      ANA_DAL_BOLUM_BASKANI: await this.headOf(s.programId),
      KOORDINATOR: e.offering.coordinatorUsername,
      HEDEF_BOLUM_BASKANI: await this.headOf(e.programId),
    };
  }

  private async openApprovals(tx: Prisma.TransactionClient, subjectType: ApprovalSubject, subjectId: string, round: number, roles: ApprovalRole[], e: EnrollmentCtx) {
    const who = await this.assignees(e);
    await tx.approval.createMany({
      data: roles.map((role) => ({ subjectType, subjectId, round, role, assigneeUsername: who[role] })),
    });
    return [...new Set(roles.map((r) => who[r]).filter(Boolean) as string[])];
  }

  private assertCoordinator(user: AuthUser, e: EnrollmentCtx) {
    this.access.assertOffering(user, e.offering, ['KOORDINATOR', 'OIDB']);
  }

  // ---------------- Protokol ----------------

  /** Protokole yazılabilecek dersler ve ortak sayılan AKTS (Yönerge m.7/2). */
  async protocolOptions(e: EnrollmentCtx) {
    const s = await this.obis.getStudent(e.studentNo);
    const [target, main, program] = await Promise.all([
      this.prisma.programCourse.findMany({ where: { programId: e.programId }, orderBy: [{ semester: 'asc' }, { code: 'asc' }] }),
      this.prisma.programCourse.findMany({ where: { programId: s.programId } }),
      this.prisma.program.findUniqueOrThrow({ where: { id: e.programId } }),
    ]);
    const mainCodes = new Set(main.map((c) => c.code));
    if (e.type === 'YANDAL') {
      return {
        program,
        mainCodes,
        commonCourses: [],
        commonEcts: 0,
        courses: e.offering.poolCourses.map((c) => ({ code: c.courseCode, name: c.name, ects: c.ects, semester: null as number | null, inMain: mainCodes.has(c.courseCode) })),
        poolEcts: e.offering.poolCourses.reduce((t, c) => t + c.ects, 0),
      };
    }
    const common = target.filter((c) => c.common && mainCodes.has(c.code));
    return {
      program,
      mainCodes,
      commonCourses: common,
      commonEcts: common.reduce((t, c) => t + c.ects, 0),
      courses: target.filter((c) => !c.common).map((c) => ({ code: c.code, name: c.name, ects: c.ects, semester: c.semester as number | null, inMain: mainCodes.has(c.code) })),
      poolEcts: 0,
    };
  }

  async evaluateProtocol(e: EnrollmentCtx, codes: string[]): Promise<{ results: RuleResult[]; ok: boolean; options: Awaited<ReturnType<FormsService['protocolOptions']>> }> {
    const options = await this.protocolOptions(e);
    const chosen = options.courses.filter((c) => codes.includes(c.code));
    const { def } = await this.rules.active(e.type);
    const outcome = evaluate(def, 'PROTOCOL', {
      protocol: {
        level: options.program.level,
        durationYears: options.program.durationYears,
        courseEcts: chosen.reduce((t, c) => t + c.ects, 0),
        courseCount: chosen.length,
        commonEcts: options.commonEcts,
        overlapCodes: chosen.filter((c) => options.mainCodes.has(c.code)).map((c) => c.code),
      },
      minorPlan:
        e.type === 'YANDAL'
          ? { poolEcts: options.poolEcts, planEcts: chosen.reduce((t, c) => t + c.ects, 0), planCourseCount: chosen.length }
          : undefined,
    });
    return { results: outcome.results.filter((r) => r.status !== 'NOT_APPLICABLE'), ok: outcome.verdict !== 'INELIGIBLE', options };
  }

  /** Koordinatör protokolü hazırlar ya da değiştirir. Onaylanmış protokolde değişiklik tüm imzaları yeniden ister (Esaslar m.3). */
  async saveProtocol(user: AuthUser, enrollmentId: string, codes: string[], reason?: string) {
    const e = await this.enrollment(enrollmentId);
    this.assertCoordinator(user, e);
    if (e.status !== 'ACTIVE' && e.status !== 'FROZEN') throw conflict('Yalnızca etkin kayıtlar için protokol düzenlenir.');
    const { options, results } = await this.evaluateProtocol(e, codes);
    const unknown = codes.filter((c) => !options.courses.some((x) => x.code === c));
    if (unknown.length) throw unprocessable(`Programda olmayan ders: ${unknown.join(', ')}`);
    const chosen = options.courses.filter((c) => codes.includes(c.code));

    const existing = await this.prisma.protocol.findUnique({ where: { enrollmentId } });
    if (existing && existing.status === 'IN_APPROVAL') throw conflict('Protokol onayda; değiştirmek için önce bir imzacının reddetmesi gerekir.');
    const isRevision = existing && !EDITABLE.includes(existing.status);
    if (isRevision && (!reason || reason.trim().length < 5)) throw unprocessable('Onaylanmış protokolde değişiklik için gerekçe girin (örn. dersin programdan kalkması).');

    const saved = await this.prisma.$transaction(async (tx) => {
      const p = existing
        ? await tx.protocol.update({
            where: { id: existing.id },
            data: { status: 'DRAFT', commonEcts: options.commonEcts, round: isRevision ? existing.round + 1 : existing.round, approvedAt: null, filedAt: null, filedBy: null },
          })
        : await tx.protocol.create({ data: { enrollmentId, commonEcts: options.commonEcts, createdBy: user.username } });
      await tx.protocolCourse.deleteMany({ where: { protocolId: p.id } });
      await tx.protocolCourse.createMany({ data: chosen.map((c) => ({ protocolId: p.id, code: c.code, name: c.name, ects: c.ects })) });
      await this.audit.log(
        { actor: user.username, action: isRevision ? 'PROTOCOL_REVISE' : 'PROTOCOL_SAVE', entity: 'Protocol', entityId: p.id, after: { codes, commonEcts: options.commonEcts }, reason },
        tx,
      );
      return p;
    });
    return { protocol: saved, results };
  }

  async submitProtocol(user: AuthUser, enrollmentId: string) {
    const e = await this.enrollment(enrollmentId);
    this.assertCoordinator(user, e);
    const p = await this.prisma.protocol.findUnique({ where: { enrollmentId }, include: { courses: true } });
    if (!p) throw notFound('Protokol');
    if (!EDITABLE.includes(p.status)) throw conflict('Protokol zaten onaya gönderildi.');
    const { results, ok } = await this.evaluateProtocol(e, p.courses.map((c) => c.code));
    if (!ok) throw unprocessable('Protokol kuralları sağlamıyor.', { results: results.filter((r) => r.status === 'FAIL') });
    const round = p.status === 'REJECTED' ? p.round + 1 : p.round;
    const notify = await this.prisma.$transaction(async (tx) => {
      await tx.protocol.update({ where: { id: p.id }, data: { status: 'IN_APPROVAL', submittedAt: new Date(), round } });
      const people = await this.openApprovals(tx, 'PROTOCOL', p.id, round, PROTOCOL_SIGNERS, e);
      await this.audit.log({ actor: user.username, action: 'PROTOCOL_SUBMIT', entity: 'Protocol', entityId: p.id, after: { round } }, tx);
      return people;
    });
    await this.notifications.notifyMany(
      notify.filter((u) => u !== user.username),
      'Onayınız bekleniyor: Kabul ve Ders Protokolü',
      `${e.studentNo} numaralı öğrencinin ${e.offering.program.name} ${LABELS.track[e.type].toLowerCase()} protokolü onayınıza sunuldu.`,
      '/onaylar',
    );
    return { ok: true };
  }

  /** Aslı öğrenci işlerindeki dosyada (İİBF ilkeleri: "Protokolün aslı öğrencinin öğrenci işlerindeki dosyasında bulunması gerekir"). */
  async fileProtocol(user: AuthUser, enrollmentId: string) {
    const e = await this.enrollment(enrollmentId);
    this.access.assertOffering(user, e.offering, ['BIRIM', 'OIDB']);
    const p = await this.prisma.protocol.findUnique({ where: { enrollmentId } });
    if (!p || p.status !== 'APPROVED') throw conflict('Yalnızca tüm imzaları tamamlanmış protokol dosyalanır.');
    await this.prisma.protocol.update({ where: { id: p.id }, data: { status: 'FILED', filedAt: new Date(), filedBy: user.username } });
    await this.audit.log({ actor: user.username, action: 'PROTOCOL_FILE', entity: 'Protocol', entityId: p.id });
    return { ok: true };
  }

  // ---------------- Dönemlik ders kayıt formu ----------------

  async saveCourseRegistration(user: AuthUser, enrollmentId: string, termId: string, codes: string[]) {
    const e = await this.enrollment(enrollmentId);
    this.assertCoordinator(user, e);
    if (e.status !== 'ACTIVE') throw conflict('Yalnızca etkin kayıtlar için ders kaydı yapılır.');
    const protocol = await this.prisma.protocol.findUnique({ where: { enrollmentId }, include: { courses: true } });
    if (!protocol || !['APPROVED', 'FILED'].includes(protocol.status)) {
      throw conflict('Ders kaydı için Kabul ve Ders Protokolü onaylanmış olmalı.');
    }
    const leave = await this.prisma.termLeave.findUnique({ where: { enrollmentId_termId: { enrollmentId, termId } } });
    if (leave && (leave.reason === 'ERASMUS' || leave.reason === 'FARABI')) {
      throw conflict(`${LABELS.leave[leave.reason]} dönemi: bu dönemde ÇAP / yan dal ders kaydı yapılamaz (İİBF ilkeleri).`);
    }
    const track = await this.obis.getTrack(e.studentNo, e.programId);
    const passed = new Set(track.results.filter((r) => r.passed).map((r) => r.code));
    const allowed = protocol.courses.filter((c) => !passed.has(c.code));
    const bad = codes.filter((c) => !allowed.some((a) => a.code === c));
    if (bad.length) throw unprocessable(`Protokolde olmayan ya da daha önce geçilmiş ders: ${bad.join(', ')}`);

    const existing = await this.prisma.courseRegistration.findUnique({ where: { enrollmentId_termId: { enrollmentId, termId } } });
    if (existing && !EDITABLE.includes(existing.status)) throw conflict('Bu dönemin ders kayıt formu onaya gönderildi.');
    const chosen = allowed.filter((c) => codes.includes(c.code));
    const reg = await this.prisma.$transaction(async (tx) => {
      const r = existing ?? (await tx.courseRegistration.create({ data: { enrollmentId, termId, createdBy: user.username } }));
      await tx.courseRegistrationItem.deleteMany({ where: { courseRegistrationId: r.id } });
      await tx.courseRegistrationItem.createMany({ data: chosen.map((c) => ({ courseRegistrationId: r.id, code: c.code, name: c.name, ects: c.ects })) });
      if (existing?.status === 'REJECTED') await tx.courseRegistration.update({ where: { id: r.id }, data: { status: 'DRAFT' } });
      await this.audit.log({ actor: user.username, action: 'COURSE_REG_SAVE', entity: 'CourseRegistration', entityId: r.id, after: { termId, codes } }, tx);
      return r;
    });
    return reg;
  }

  async submitCourseRegistration(user: AuthUser, enrollmentId: string, termId: string) {
    const e = await this.enrollment(enrollmentId);
    this.assertCoordinator(user, e);
    const r = await this.prisma.courseRegistration.findUnique({ where: { enrollmentId_termId: { enrollmentId, termId } }, include: { items: true } });
    if (!r) throw notFound('Ders kayıt formu');
    if (!EDITABLE.includes(r.status)) throw conflict('Form zaten onaya gönderildi.');
    if (!r.items.length) throw unprocessable('Formda ders yok.');
    const round = r.status === 'REJECTED' ? r.round + 1 : r.round;
    const people = await this.prisma.$transaction(async (tx) => {
      await tx.courseRegistration.update({ where: { id: r.id }, data: { status: 'IN_APPROVAL', round } });
      const p = await this.openApprovals(tx, 'COURSE_REG', r.id, round, COURSE_REG_SIGNERS[e.type], e);
      await this.audit.log({ actor: user.username, action: 'COURSE_REG_SUBMIT', entity: 'CourseRegistration', entityId: r.id, after: { round } }, tx);
      return p;
    });
    await this.notifications.notifyMany(
      people.filter((u) => u !== user.username),
      'Onayınız bekleniyor: ders kayıt formu',
      `${e.studentNo} numaralı öğrencinin ${e.offering.program.name} ${LABELS.track[e.type].toLowerCase()} ders kayıt formu onayınıza sunuldu.`,
      '/onaylar',
    );
    return { ok: true };
  }

  /** Koordinatör onaylanmış formları toplu hâlde öğrenci işlerine teslim eder (Esaslar m.4). */
  async submitBatch(user: AuthUser, termId: string, offeringIds?: string[]) {
    const forms = await this.prisma.courseRegistration.findMany({
      where: { termId, status: 'APPROVED', enrollment: { offering: this.access.offeringWhere(user), ...(offeringIds?.length ? { offeringId: { in: offeringIds } } : {}) } },
      include: { enrollment: { include: { offering: { include: { program: true } } } } },
    });
    if (!forms.length) throw conflict('Teslim edilecek onaylanmış form yok.');
    const forbiddenOnes = forms.filter((f) => !this.access.canOnOffering(user, f.enrollment.offering, ['KOORDINATOR', 'OIDB']));
    if (forbiddenOnes.length) throw forbidden();
    await this.prisma.courseRegistration.updateMany({
      where: { id: { in: forms.map((f) => f.id) } },
      data: { status: 'SUBMITTED', submittedAt: new Date(), submittedBy: user.username },
    });
    await this.audit.log({ actor: user.username, action: 'COURSE_REG_BATCH_SUBMIT', entity: 'Term', entityId: termId, after: { count: forms.length } });
    const units = [...new Set(forms.map((f) => f.enrollment.offering.program.unitId))];
    const staff = await this.prisma.roleAssignment.findMany({ where: { role: 'BIRIM', unitId: { in: units } }, include: { user: true } });
    await this.notifications.notifyMany(
      staff.map((s) => s.user.username),
      "Ders kayıt formları teslim edildi",
      `${forms.length} ÇAP / yan dal ders kayıt formu OBİS'e girilmek üzere teslim edildi.`,
      '/birim/ders-kayitlari',
    );
    return { count: forms.length };
  }

  async listCourseRegistrations(user: AuthUser, termId: string, status?: FormStatus) {
    const rows = await this.prisma.courseRegistration.findMany({
      where: { termId, ...(status ? { status } : {}), enrollment: { offering: this.access.offeringWhere(user) } },
      include: { items: true, enrollment: { include: { offering: { include: { program: { include: { unit: true } } } } } } },
      orderBy: [{ enrollment: { offering: { program: { name: 'asc' } } } }, { enrollment: { studentNo: 'asc' } }],
    });
    const names = new Map<string, string>();
    for (const r of rows) {
      if (!names.has(r.enrollment.studentNo)) names.set(r.enrollment.studentNo, (await this.obis.getStudent(r.enrollment.studentNo).catch(() => null))?.fullName ?? r.enrollment.studentNo);
    }
    return rows.map((r) => ({
      id: r.id,
      status: r.status,
      termId: r.termId,
      enrollmentId: r.enrollmentId,
      studentNo: r.enrollment.studentNo,
      fullName: names.get(r.enrollment.studentNo),
      type: r.enrollment.type,
      programName: r.enrollment.offering.program.name,
      unitName: r.enrollment.offering.program.unit.name,
      submittedAt: r.submittedAt,
      enteredAt: r.enteredAt,
      items: r.items,
    }));
  }

  /** Öğrenci işleri OBİS'e girdiği formları işaretler. */
  async markEntered(user: AuthUser, ids: string[]) {
    const forms = await this.prisma.courseRegistration.findMany({
      where: { id: { in: ids } },
      include: { enrollment: { include: { offering: { include: { program: true } } } } },
    });
    for (const f of forms) {
      this.access.assertOffering(user, f.enrollment.offering, ['BIRIM', 'OIDB']);
      if (f.status !== 'SUBMITTED') throw conflict('Yalnızca teslim edilmiş formlar işaretlenebilir.');
    }
    await this.prisma.courseRegistration.updateMany({ where: { id: { in: ids } }, data: { status: 'ENTERED', enteredAt: new Date(), enteredBy: user.username } });
    await this.audit.log({ actor: user.username, action: 'COURSE_REG_ENTERED', entity: 'CourseRegistration', entityId: ids.join(','), after: { count: ids.length } });
    return { count: ids.length };
  }

  /** OBİS'e girilecek toplu liste (CSV). */
  async exportCourseRegistrations(user: AuthUser, termId: string) {
    const rows = await this.listCourseRegistrations(user, termId, 'SUBMITTED');
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Öğrenci No', 'Ad Soyad', 'Tür', 'Program', 'Ders Kodu', 'Ders Adı', 'AKTS'].map(esc).join(';')];
    for (const r of rows) {
      for (const i of r.items) lines.push([r.studentNo, r.fullName, LABELS.track[r.type], r.programName, i.code, i.name, i.ects].map(esc).join(';'));
    }
    return '﻿' + lines.join('\r\n');
  }

  // ---------------- Onaylar ----------------

  private async subject(type: ApprovalSubject, id: string) {
    if (type === 'PROTOCOL') {
      const p = await this.prisma.protocol.findUniqueOrThrow({ where: { id }, include: { courses: true } });
      return { kind: 'PROTOCOL' as const, enrollmentId: p.enrollmentId, status: p.status, round: p.round, ects: p.courses.reduce((t, c) => t + c.ects, 0) + p.commonEcts, courseCount: p.courses.length, termId: null as string | null };
    }
    const r = await this.prisma.courseRegistration.findUniqueOrThrow({ where: { id }, include: { items: true } });
    return { kind: 'COURSE_REG' as const, enrollmentId: r.enrollmentId, status: r.status, round: r.round, ects: r.items.reduce((t, c) => t + c.ects, 0), courseCount: r.items.length, termId: r.termId };
  }

  async myApprovals(user: AuthUser) {
    const rows = await this.prisma.approval.findMany({
      where: { decision: 'PENDING', assigneeUsername: user.username },
      orderBy: { createdAt: 'asc' },
    });
    const out = [];
    for (const a of rows) {
      const sub = await this.subject(a.subjectType, a.subjectId);
      if (sub.status !== 'IN_APPROVAL' || sub.round !== a.round) continue;
      const e = await this.enrollment(sub.enrollmentId);
      const s = await this.obis.getStudent(e.studentNo).catch(() => null);
      out.push({
        id: a.id,
        role: a.role,
        roleLabel: LABELS.approvalRole[a.role],
        createdAt: a.createdAt,
        subject: { ...sub, label: sub.kind === 'PROTOCOL' ? 'Kabul ve Ders Protokolü' : 'Ders kayıt formu' },
        enrollment: { id: e.id, studentNo: e.studentNo, fullName: s?.fullName ?? e.studentNo, type: e.type, programName: e.offering.program.name },
      });
    }
    return out;
  }

  async decide(user: AuthUser, approvalId: string, decision: 'APPROVED' | 'REJECTED', comment?: string) {
    const a = await this.prisma.approval.findUnique({ where: { id: approvalId } });
    if (!a) throw notFound('Onay');
    const sub = await this.subject(a.subjectType, a.subjectId);
    const e = await this.enrollment(sub.enrollmentId);
    // Öğrencinin ıslak imzasını koordinatör ya da birim öğrenci işleri işler; diğer imzalar yalnızca atanan kişiye aittir.
    const allowed =
      a.assigneeUsername === user.username ||
      (a.role === 'OGRENCI_IMZA' && this.access.canOnOffering(user, e.offering, ['BIRIM']));
    if (!allowed) throw forbidden('Bu onay size atanmamış.');
    if (a.decision !== 'PENDING' || sub.status !== 'IN_APPROVAL' || sub.round !== a.round) throw conflict('Bu onay artık geçerli değil.');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.approval.update({ where: { id: a.id }, data: { decision, decidedBy: user.username, decidedAt: new Date(), comment } });
      const siblings = await tx.approval.findMany({ where: { subjectType: a.subjectType, subjectId: a.subjectId, round: a.round } });
      let newStatus: FormStatus | null = null;
      if (decision === 'REJECTED') newStatus = 'REJECTED';
      else if (siblings.every((s) => (s.id === a.id ? true : s.decision === 'APPROVED'))) newStatus = 'APPROVED';
      if (newStatus) {
        if (a.subjectType === 'PROTOCOL') {
          await tx.protocol.update({ where: { id: a.subjectId }, data: { status: newStatus, ...(newStatus === 'APPROVED' ? { approvedAt: new Date() } : {}) } });
        } else {
          await tx.courseRegistration.update({ where: { id: a.subjectId }, data: { status: newStatus, ...(newStatus === 'APPROVED' ? { approvedAt: new Date() } : {}) } });
        }
        // Ret sonrası bekleyen diğer imzalar düşer; form yeniden gönderildiğinde yeni tur açılır.
        if (newStatus === 'REJECTED') {
          await tx.approval.updateMany({ where: { subjectType: a.subjectType, subjectId: a.subjectId, round: a.round, decision: 'PENDING' }, data: { decision: 'REJECTED', comment: 'Başka bir imzacı reddettiği için düştü' } });
        }
      }
      await this.audit.log(
        { actor: user.username, action: `APPROVAL_${decision}`, entity: a.subjectType === 'PROTOCOL' ? 'Protocol' : 'CourseRegistration', entityId: a.subjectId, after: { role: a.role, round: a.round }, reason: comment },
        tx,
      );
      return newStatus;
    });

    if (result) {
      const what = a.subjectType === 'PROTOCOL' ? 'Kabul ve Ders Protokolü' : 'Ders kayıt formu';
      await this.notifications.notify(
        e.offering.coordinatorUsername,
        `${what} ${result === 'APPROVED' ? 'onaylandı' : 'reddedildi'}`,
        `${e.studentNo} numaralı öğrencinin ${what.toLowerCase()} ${result === 'APPROVED' ? 'tüm imzaları tamamlandı' : `${user.username} tarafından reddedildi: ${comment ?? ''}`}.`,
        `/kayitlar/${e.id}`,
      );
      if (result === 'APPROVED' && a.subjectType === 'PROTOCOL') {
        const staff = await this.prisma.roleAssignment.findMany({ where: { role: 'BIRIM', unitId: e.offering.program.unitId }, include: { user: true } });
        await this.notifications.notifyMany(
          staff.map((s) => s.user.username),
          'Protokol onaylandı: aslı dosyaya',
          `${e.studentNo} numaralı öğrencinin protokol imzaları tamamlandı. Aslı öğrenci dosyasına kaldırılmalı.`,
          `/kayitlar/${e.id}`,
        );
      }
    }
    return { ok: true, formStatus: result };
  }

  async approvalsFor(type: ApprovalSubject, id: string) {
    return this.prisma.approval.findMany({ where: { subjectType: type, subjectId: id }, orderBy: [{ round: 'desc' }, { createdAt: 'asc' }] });
  }
}
