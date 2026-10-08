import { Injectable } from '@nestjs/common';
import { GRADE_POINTS, LABELS, PASSING_GRADES, SIGNERS, type ApprovalRole, type Grade } from '@cap/contracts';
import type { ApprovalSubject, Course, FormStatus, Prisma, ProtocolCondition, ProtocolCourse } from '@prisma/client';
import type { AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService, offeringInclude } from '../catalog/catalog.service';
import { conflict, forbidden, notFound, unprocessable } from '../common/http';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { TemplatesService } from './templates';

const EDITABLE: FormStatus[] = ['DRAFT', 'REJECTED'];
const OPEN_ITEM = ['PENDING', 'FAILED'];

export const enrollmentInclude = {
  offering: { include: offeringInclude },
  student: { include: { program: true, user: { select: { username: true } } } },
} satisfies Prisma.EnrollmentInclude;

export type EnrollmentCtx = Prisma.EnrollmentGetPayload<{ include: typeof enrollmentInclude }>;

/** AKTS ağırlıklı ortalama; kredisiz (G) ve muaf (M) dersler katılmaz. */
export function weightedGpa(courses: Pick<ProtocolCourse, 'grade' | 'ects' | 'status'>[]): number | null {
  let points = 0;
  let ects = 0;
  for (const c of courses) {
    const p = c.grade ? GRADE_POINTS[c.grade as Grade] : null;
    if (p === null || p === undefined || c.status === 'EXEMPT') continue;
    points += p * c.ects;
    ects += c.ects;
  }
  return ects ? Math.round((points / ects) * 100) / 100 : null;
}

/**
 * Üç form ve imzaları (Bölüm ÇAP Rehberi 2025):
 *  - Kabul ve Ders Protokolü: koordinatör şablondan üretir; 5 imza.
 *  - Ders Kayıt Formu (FORM01): öğrenci hazırlar; öğrenci + ana dal danışmanı + koordinatör.
 *  - Özel Şartlı Derslerin Muafiyeti Formu: öğrenci hazırlar; öğrenci + ana dal danışmanı + koordinatör.
 */
@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
    private readonly templates: TemplatesService,
    private readonly notifications: NotificationsService,
  ) {}

  async enrollment(id: string): Promise<EnrollmentCtx> {
    const e = await this.prisma.enrollment.findUnique({ where: { id }, include: enrollmentInclude });
    if (!e) throw notFound('Kayıt');
    return e;
  }

  canView(user: AuthUser, e: EnrollmentCtx) {
    return this.access.canSeeStudent(user, e.student, e.mainAdvisorUsername);
  }

  async assertView(user: AuthUser, e: EnrollmentCtx) {
    if (!(await this.canView(user, e))) throw forbidden('Bu kayda erişim yetkiniz yok.');
  }

  isOwner(user: AuthUser, e: EnrollmentCtx) {
    return user.studentNo === e.studentNo;
  }

  private assertOwnerOrCoordinator(user: AuthUser, e: EnrollmentCtx) {
    if (!this.isOwner(user, e) && !this.access.isCoordinator(user)) throw forbidden('Bu form yalnızca öğrencinin kendisi ya da koordinatör tarafından düzenlenir.');
  }

  private async headOf(programId: string) {
    const a = await this.prisma.roleAssignment.findFirst({ where: { role: 'BOLUM_BASKANI', programId }, include: { user: true } });
    return a?.user.username ?? null;
  }

  /**
   * Her imzacı rolü için imzalayacak hesap. KOORDINATOR imzası kişiye değil role bağlıdır (komisyon üyelerinden
   * biri atar). Ana dal danışmanının ya da bölüm başkanının hesabı yoksa atama boş kalır ve ıslak imzayı
   * koordinatör işler.
   */
  private async assignees(e: EnrollmentCtx): Promise<Record<ApprovalRole, string | null>> {
    const home = await this.access.home();
    return {
      OGRENCI: e.student.user.username,
      ANA_DAL_DANISMANI: e.mainAdvisorUsername,
      ANA_DAL_BOLUM_BASKANI: await this.headOf(e.student.programId),
      KOORDINATOR: null,
      CAP_BOLUM_BASKANI: await this.headOf(home.id),
    };
  }

  /** İmza satırlarını açar. Formu öğrenci gönderdiyse kendi imzası gönderimle birlikte atılmış sayılır. */
  private async openApprovals(tx: Prisma.TransactionClient, subjectType: ApprovalSubject, subjectId: string, round: number, e: EnrollmentCtx, submitter: AuthUser) {
    const who = await this.assignees(e);
    const roles = SIGNERS[subjectType];
    const now = new Date();
    await tx.approval.createMany({
      data: roles.map((role) => {
        // Formu hazırlayıp gönderen kişinin kendi imzası gönderimle birlikte atılmış sayılır.
        const self = (role === 'OGRENCI' && who.OGRENCI === submitter.username) || (role === 'KOORDINATOR' && this.access.isCoordinator(submitter));
        return { subjectType, subjectId, round, role, assigneeUsername: who[role], ...(self ? { decision: 'APPROVED' as const, decidedBy: submitter.username, decidedAt: now } : {}) };
      }),
    });
    const people = roles.map((r) => who[r]).filter((u): u is string => !!u && u !== submitter.username);
    return [...new Set(people)];
  }

  private async announce(people: string[], subjectType: ApprovalSubject, e: EnrollmentCtx, submitter: AuthUser) {
    const body = `${e.student.fullName} (${e.studentNo}) için ${LABELS.subject[subjectType].toLowerCase()} imzanıza sunuldu.`;
    await this.notifications.notifyMany(people, `İmzanız bekleniyor: ${LABELS.subject[subjectType]}`, body, '/onaylar');
    if (!this.access.isCoordinator(submitter)) await this.notifications.notifyCoordinators(`İmza bekliyor: ${LABELS.subject[subjectType]}`, body, '/onaylar');
  }

  // ---------------- Kabul ve Ders Protokolü ----------------

  /** Koordinatör protokolü şablondan üretir. Yan dalda öğrencinin planı havuzdan seçilir. */
  async createProtocol(user: AuthUser, enrollmentId: string, itemIds?: string[]) {
    const e = await this.enrollment(enrollmentId);
    if (e.status !== 'ACTIVE' && e.status !== 'FROZEN') throw conflict('Yalnızca etkin kayıtlar için protokol düzenlenir.');
    const template = await this.templates.forStudent(e.type, e.student.programId);
    if (!template) {
      throw conflict(`${e.student.program.name} bölümü için ${LABELS.track[e.type].toLowerCase()} protokol şablonu tanımlı değil. Önce "Protokol şablonları" sayfasından tanımlayın.`);
    }
    const existing = await this.prisma.protocol.findUnique({ where: { enrollmentId } });
    if (existing && !EDITABLE.includes(existing.status)) throw conflict('Protokol imzada ya da imzaları tamamlanmış; yeniden üretilemez.');

    const items = e.type === 'CAP' ? template.items : template.items.filter((i) => itemIds?.includes(i.id));
    if (!items.length) throw unprocessable('Yan dal planı için havuzdan ders seçin.');
    const poolEcts = template.items.reduce((s, i) => s + i.ects, 0);
    const ects = items.reduce((s, i) => s + i.ects, 0);
    const check = await this.templates.check(e.type, ects, items.length, template.commonEcts, poolEcts);
    if (!check.ok) throw unprocessable('Protokol kuralları sağlamıyor.', { results: check.results.filter((r) => r.status === 'FAIL') });

    const protocol = await this.prisma.$transaction(async (tx) => {
      const p = existing
        ? await tx.protocol.update({ where: { id: existing.id }, data: { status: 'DRAFT', templateId: template.id, commonEcts: template.commonEcts } })
        : await tx.protocol.create({ data: { enrollmentId, templateId: template.id, commonEcts: template.commonEcts, createdBy: user.username } });
      await tx.protocolCourse.deleteMany({ where: { protocolId: p.id } });
      await tx.protocolCourse.createMany({
        data: items.map((i, position) => ({ protocolId: p.id, position, kind: i.kind, code: i.code, name: i.name, ects: i.ects, semester: i.semester })),
      });
      await this.audit.log({ actor: user.username, action: 'PROTOCOL_CREATE', entity: 'Protocol', entityId: p.id, after: { templateId: template.id, items: items.length, ects, commonEcts: template.commonEcts } }, tx);
      return p;
    });
    return { protocol, results: check.results };
  }

  async submitProtocol(user: AuthUser, enrollmentId: string) {
    const e = await this.enrollment(enrollmentId);
    const p = await this.prisma.protocol.findUnique({ where: { enrollmentId } });
    if (!p) throw notFound('Protokol');
    if (!EDITABLE.includes(p.status)) throw conflict('Protokol zaten imzaya gönderildi.');
    const round = p.status === 'REJECTED' ? p.round + 1 : p.round;
    const people = await this.prisma.$transaction(async (tx) => {
      await tx.protocol.update({ where: { id: p.id }, data: { status: 'IN_APPROVAL', submittedAt: new Date(), round } });
      const list = await this.openApprovals(tx, 'PROTOCOL', p.id, round, e, user);
      await this.audit.log({ actor: user.username, action: 'PROTOCOL_SUBMIT', entity: 'Protocol', entityId: p.id, after: { round } }, tx);
      return list;
    });
    await this.announce(people, 'PROTOCOL', e, user);
    return { ok: true };
  }

  // ---------------- Dönemlik ders kayıt formu (FORM01) ----------------

  /** Bu dönem forma yazılabilecek satırlar: protokolde henüz geçilmemiş dersler ve boş seçmeli ders yerleri. */
  async registrationOptions(protocolId: string) {
    const [courses, electives] = await Promise.all([
      this.prisma.protocolCourse.findMany({ where: { protocolId }, orderBy: { position: 'asc' } }),
      this.prisma.course.findMany({ where: { kind: 'TEKNIK_SECMELI' }, orderBy: { code: 'asc' } }),
    ]);
    const used = new Set(courses.map((c) => c.fulfilledCode).filter(Boolean));
    return courses
      .filter((c) => OPEN_ITEM.includes(c.status))
      .map((c) => ({
        protocolCourseId: c.id,
        kind: c.kind,
        code: c.code,
        name: c.name,
        ects: c.ects,
        semester: c.semester,
        status: c.status,
        choices: c.kind === 'ELECTIVE_SLOT' ? electives.filter((x) => x.semester === c.semester && !used.has(x.code)).map((x) => ({ code: x.code, name: x.name, ects: x.ects })) : [],
      }));
  }

  async saveCourseRegistration(user: AuthUser, enrollmentId: string, termId: string, items: { protocolCourseId: string; courseCode?: string }[]) {
    const e = await this.enrollment(enrollmentId);
    this.assertOwnerOrCoordinator(user, e);
    if (e.status !== 'ACTIVE') throw conflict('Yalnızca etkin kayıtlar için ders kaydı yapılır.');
    const term = await this.catalog.currentTerm();
    if (!term || term.id !== termId) throw conflict('Ders kayıt formu yalnızca içinde bulunulan dönem için hazırlanır.');
    const protocol = await this.prisma.protocol.findUnique({ where: { enrollmentId } });
    if (!protocol || protocol.status !== 'APPROVED') throw conflict('Ders kaydı için Kabul ve Ders Protokolünün imzaları tamamlanmış olmalı.');
    const leave = await this.prisma.termLeave.findUnique({ where: { enrollmentId_termId: { enrollmentId, termId } } });
    if (leave && (leave.reason === 'ERASMUS' || leave.reason === 'FARABI')) throw conflict(`${LABELS.leave[leave.reason]} dönemi: bu dönemde ders kaydı yapılamaz.`);

    const options = await this.registrationOptions(protocol.id);
    const rows: { protocolCourseId: string; code: string; name: string; ects: number }[] = [];
    for (const it of items) {
      const o = options.find((x) => x.protocolCourseId === it.protocolCourseId);
      if (!o) throw unprocessable('Protokolde olmayan ya da daha önce geçilmiş bir ders seçildi.');
      if (o.kind === 'COURSE') {
        rows.push({ protocolCourseId: o.protocolCourseId, code: o.code!, name: o.name, ects: o.ects });
      } else {
        const choice = o.choices.find((c) => c.code === it.courseCode);
        if (!choice) throw unprocessable(`${o.name}: bu yere yazılacak teknik seçmeli dersi seçin.`);
        rows.push({ protocolCourseId: o.protocolCourseId, ...choice });
      }
    }
    if (new Set(rows.map((r) => r.code)).size !== rows.length) throw unprocessable('Aynı ders forma iki kez yazılamaz.');

    const existing = await this.prisma.courseRegistration.findUnique({ where: { enrollmentId_termId: { enrollmentId, termId } } });
    if (existing && !EDITABLE.includes(existing.status)) throw conflict('Bu dönemin ders kayıt formu imzaya gönderildi.');
    return this.prisma.$transaction(async (tx) => {
      const r = existing ?? (await tx.courseRegistration.create({ data: { enrollmentId, termId, createdBy: user.username } }));
      await tx.courseRegistrationItem.deleteMany({ where: { courseRegistrationId: r.id } });
      await tx.courseRegistrationItem.createMany({ data: rows.map((x) => ({ courseRegistrationId: r.id, ...x })) });
      if (existing?.status === 'REJECTED') await tx.courseRegistration.update({ where: { id: r.id }, data: { status: 'DRAFT' } });
      await this.audit.log({ actor: user.username, action: 'COURSE_REG_SAVE', entity: 'CourseRegistration', entityId: r.id, after: { termId, codes: rows.map((x) => x.code) } }, tx);
      return r;
    });
  }

  async submitCourseRegistration(user: AuthUser, enrollmentId: string, termId: string) {
    const e = await this.enrollment(enrollmentId);
    this.assertOwnerOrCoordinator(user, e);
    const r = await this.prisma.courseRegistration.findUnique({ where: { enrollmentId_termId: { enrollmentId, termId } }, include: { items: true } });
    if (!r) throw notFound('Ders kayıt formu');
    if (!EDITABLE.includes(r.status)) throw conflict('Form zaten imzaya gönderildi.');
    if (!r.items.length) throw unprocessable('Formda ders yok.');
    const round = r.round + (r.submittedAt ? 1 : 0);
    const people = await this.prisma.$transaction(async (tx) => {
      await tx.courseRegistration.update({ where: { id: r.id }, data: { status: 'IN_APPROVAL', round, submittedAt: new Date() } });
      const list = await this.openApprovals(tx, 'COURSE_REG', r.id, round, e, user);
      await this.audit.log({ actor: user.username, action: 'COURSE_REG_SUBMIT', entity: 'CourseRegistration', entityId: r.id, after: { round } }, tx);
      return list;
    });
    await this.announce(people, 'COURSE_REG', e, user);
    return { ok: true };
  }

  /**
   * Dönem sonu not girişi. OBİS bağlantısı olmadığı için (K-12) ÇAP / yan dal derslerinin harf notunu
   * koordinatör girer; yalnızca imzaları tamamlanmış ders kayıt formundaki dersler notlandırılır.
   */
  async saveGrades(user: AuthUser, enrollmentId: string, grades: { itemId: string; grade: Grade; passed: boolean }[]) {
    const e = await this.enrollment(enrollmentId);
    const items = await this.prisma.courseRegistrationItem.findMany({
      where: { id: { in: grades.map((g) => g.itemId) }, courseRegistration: { enrollmentId, status: 'APPROVED' } },
      include: { courseRegistration: true, protocolCourse: true },
    });
    if (items.length !== grades.length) throw unprocessable('Not yalnızca imzaları tamamlanmış ders kayıt formundaki derslere girilir.');
    await this.prisma.$transaction(async (tx) => {
      for (const g of grades) {
        const it = items.find((x) => x.id === g.itemId)!;
        if (it.protocolCourse.status === 'EXEMPT') throw conflict(`${it.name}: muaf sayılan derse not girilemez.`);
        // DC şartlı geçer (Yönetmelik m.13/3-b); başarılı sayılıp sayılmadığını koordinatör işaretler.
        const passed = g.grade === 'DC' ? g.passed : PASSING_GRADES.includes(g.grade);
        const slot = it.protocolCourse.kind === 'ELECTIVE_SLOT';
        await tx.protocolCourse.update({
          where: { id: it.protocolCourseId },
          data: { status: passed ? 'PASSED' : 'FAILED', grade: g.grade, termId: it.courseRegistration.termId, fulfilledCode: slot && passed ? it.code : null, fulfilledName: slot && passed ? it.name : null },
        });
      }
      await this.audit.log({ actor: user.username, action: 'GRADES_SAVE', entity: 'Enrollment', entityId: enrollmentId, after: grades.map((g) => ({ code: items.find((x) => x.id === g.itemId)!.code, grade: g.grade })) }, tx);
    });
    await this.notifications.notify(e.student.user.username, 'Dönem notlarınız işlendi', `${grades.length} dersin notu ${LABELS.track[e.type].toLowerCase()} kaydınıza işlendi.`, `/kayitlar/${e.id}`);
    return { ok: true };
  }

  // ---------------- Özel şartlı derslerin muafiyeti ----------------

  /** Özel şartın protokoldeki karşılığı: aynı kodlu ders, yoksa aynı yarıyılın boş teknik seçmeli yeri. */
  private target(cond: ProtocolCondition, courses: ProtocolCourse[], catalog: Course[], reserved: Set<string>) {
    const direct = courses.find((c) => c.kind === 'COURSE' && c.code === cond.targetCourseCode);
    if (direct) return OPEN_ITEM.includes(direct.status) && !reserved.has(direct.id) ? direct : null;
    const course = catalog.find((c) => c.code === cond.targetCourseCode);
    if (course?.kind !== 'TEKNIK_SECMELI') return null;
    if (courses.some((c) => c.fulfilledCode === course.code)) return null;
    return courses.find((c) => c.kind === 'ELECTIVE_SLOT' && c.semester === course.semester && c.status === 'PENDING' && !reserved.has(c.id)) ?? null;
  }

  async exemptionOptions(enrollmentId: string, protocol: { id: string; templateId: string; status: FormStatus } | null) {
    if (!protocol) return [];
    const [conditions, courses, catalog, requests] = await Promise.all([
      this.prisma.protocolCondition.findMany({ where: { templateId: protocol.templateId }, orderBy: { no: 'asc' } }),
      this.prisma.protocolCourse.findMany({ where: { protocolId: protocol.id }, orderBy: { position: 'asc' } }),
      this.prisma.course.findMany(),
      this.prisma.exemptionRequest.findMany({ where: { enrollmentId } }),
    ]);
    const reserved = new Set(requests.filter((r) => r.status === 'IN_APPROVAL').map((r) => r.protocolCourseId));
    return conditions.map((c) => {
      const request = requests.find((r) => r.conditionId === c.id) ?? null;
      const t = this.target(c, courses, catalog, reserved);
      const course = catalog.find((x) => x.code === c.targetCourseCode);
      return {
        ...c,
        targetCourseName: course?.name ?? c.targetCourseCode,
        targetLabel: t ? (t.kind === 'COURSE' ? `${t.code} ${t.name}` : `${t.name} (${course?.name})`) : null,
        targetProtocolCourseId: t?.id ?? null,
        request,
        available: protocol.status === 'APPROVED' && !!t && (!request || request.status === 'REJECTED'),
      };
    });
  }

  async createExemption(user: AuthUser, enrollmentId: string, input: { conditionId: string; sourceGrade: Grade; sourceTerm: string }) {
    const e = await this.enrollment(enrollmentId);
    this.assertOwnerOrCoordinator(user, e);
    if (e.status !== 'ACTIVE' && e.status !== 'FROZEN') throw conflict('Yalnızca etkin kayıtlar için muafiyet başvurusu yapılır.');
    const protocol = await this.prisma.protocol.findUnique({ where: { enrollmentId } });
    if (!protocol || protocol.status !== 'APPROVED') throw conflict('Muafiyet başvurusu için protokolün imzaları tamamlanmış olmalı.');
    if (!PASSING_GRADES.includes(input.sourceGrade)) throw unprocessable('Muafiyet için ana dalda alınan dersin başarılı olması gerekir.');
    const option = (await this.exemptionOptions(enrollmentId, protocol)).find((o) => o.id === input.conditionId);
    if (!option) throw notFound('Özel şart');
    if (!option.available || !option.targetProtocolCourseId) throw conflict('Bu özel şart için başvuru yapılamaz: karşılığı olan ders geçilmiş, muaf sayılmış ya da başvurusu sürüyor.');

    const round = (option.request?.round ?? 0) + 1;
    const data = { protocolCourseId: option.targetProtocolCourseId, sourceGrade: input.sourceGrade, sourceTerm: input.sourceTerm, status: 'IN_APPROVAL' as const, round, approvedAt: null };
    const { request, people } = await this.prisma.$transaction(async (tx) => {
      const r = option.request ? await tx.exemptionRequest.update({ where: { id: option.request.id }, data }) : await tx.exemptionRequest.create({ data: { enrollmentId, conditionId: option.id, ...data } });
      const list = await this.openApprovals(tx, 'EXEMPTION', r.id, round, e, user);
      await this.audit.log({ actor: user.username, action: 'EXEMPTION_SUBMIT', entity: 'ExemptionRequest', entityId: r.id, after: { conditionNo: option.no, sourceCourseCode: option.sourceCourseCode, targetCourseCode: option.targetCourseCode, sourceGrade: input.sourceGrade } }, tx);
      return { request: r, people: list };
    });
    await this.announce(people, 'EXEMPTION', e, user);
    return request;
  }

  // ---------------- İmzalar ----------------

  private async subject(type: ApprovalSubject, id: string) {
    if (type === 'PROTOCOL') {
      const p = await this.prisma.protocol.findUniqueOrThrow({ where: { id }, include: { courses: true } });
      const ects = p.courses.reduce((t, c) => t + c.ects, 0);
      return { kind: type, enrollmentId: p.enrollmentId, status: p.status, round: p.round, summary: `${p.courses.length} satır, ${ects} AKTS${p.commonEcts ? ` + ${p.commonEcts} ortak` : ''}` };
    }
    if (type === 'COURSE_REG') {
      const r = await this.prisma.courseRegistration.findUniqueOrThrow({ where: { id }, include: { items: true, term: true } });
      return { kind: type, enrollmentId: r.enrollmentId, status: r.status, round: r.round, summary: `${r.term.year} ${r.term.season === 'GUZ' ? 'Güz' : 'Bahar'}: ${r.items.map((i) => `${i.code} ${i.name}`).join('; ')}` };
    }
    const x = await this.prisma.exemptionRequest.findUniqueOrThrow({ where: { id }, include: { condition: true, protocolCourse: true } });
    return {
      kind: type,
      enrollmentId: x.enrollmentId,
      status: x.status,
      round: x.round,
      summary: `Özel şart ${x.condition.no}: ${x.condition.sourceCourseCode} ${x.condition.sourceCourseName} (${x.sourceGrade}, ${x.sourceTerm}) → ${x.condition.targetCourseCode} dersinden muafiyet`,
    };
  }

  /** Koordinatör: komisyon imzaları ve hesabı olmayan imzacıların ıslak imzaları; diğerleri: kendine atananlar. */
  private canSign(user: AuthUser, a: { role: ApprovalRole; assigneeUsername: string | null }) {
    if (a.assigneeUsername) return a.assigneeUsername === user.username;
    return this.access.isCoordinator(user);
  }

  async myApprovals(user: AuthUser) {
    const coord = this.access.isCoordinator(user);
    const rows = await this.prisma.approval.findMany({
      where: { decision: 'PENDING', OR: [{ assigneeUsername: user.username }, ...(coord ? [{ assigneeUsername: null }] : [])] },
      orderBy: { createdAt: 'asc' },
    });
    const out = [];
    for (const a of rows) {
      const sub = await this.subject(a.subjectType, a.subjectId);
      if (sub.status !== 'IN_APPROVAL' || sub.round !== a.round) continue;
      const e = await this.enrollment(sub.enrollmentId);
      out.push({
        id: a.id,
        role: a.role,
        roleLabel: LABELS.approvalRole[a.role],
        // Hesabı olmayan imzacı adına koordinatörün işleyeceği ıslak imza
        proxy: a.role !== 'KOORDINATOR' && !a.assigneeUsername,
        createdAt: a.createdAt,
        subject: { ...sub, id: a.subjectId, label: LABELS.subject[a.subjectType] },
        enrollment: { id: e.id, studentNo: e.studentNo, fullName: e.student.fullName, type: e.type, mainProgramName: e.student.program.name },
      });
    }
    return out;
  }

  async decide(user: AuthUser, approvalId: string, decision: 'APPROVED' | 'REJECTED', comment?: string) {
    const a = await this.prisma.approval.findUnique({ where: { id: approvalId } });
    if (!a) throw notFound('İmza');
    if (!this.canSign(user, a)) throw forbidden('Bu imza size ait değil.');
    const sub = await this.subject(a.subjectType, a.subjectId);
    const e = await this.enrollment(sub.enrollmentId);
    if (a.decision !== 'PENDING' || sub.status !== 'IN_APPROVAL' || sub.round !== a.round) throw conflict('Bu imza artık geçerli değil.');
    const proxy = a.role !== 'KOORDINATOR' && !a.assigneeUsername;
    const note = proxy ? `Islak imza koordinatörce işlendi${comment ? `: ${comment}` : ''}` : comment;

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.approval.update({ where: { id: a.id }, data: { decision, decidedBy: user.username, decidedAt: new Date(), comment: note } });
      const siblings = await tx.approval.findMany({ where: { subjectType: a.subjectType, subjectId: a.subjectId, round: a.round } });
      let status: FormStatus | null = null;
      if (decision === 'REJECTED') status = 'REJECTED';
      else if (siblings.every((s) => s.decision === 'APPROVED')) status = 'APPROVED';
      if (status) {
        const data = { status, ...(status === 'APPROVED' ? { approvedAt: new Date() } : {}) };
        if (a.subjectType === 'PROTOCOL') await tx.protocol.update({ where: { id: a.subjectId }, data });
        else if (a.subjectType === 'COURSE_REG') await tx.courseRegistration.update({ where: { id: a.subjectId }, data });
        else {
          const x = await tx.exemptionRequest.update({ where: { id: a.subjectId }, data, include: { condition: true } });
          if (status === 'APPROVED') {
            const course = await tx.course.findUnique({ where: { code: x.condition.targetCourseCode } });
            // Muaf sayılan ders (M): ortalamaya katılmaz, protokol AKTS'sine sayılır.
            await tx.protocolCourse.update({ where: { id: x.protocolCourseId }, data: { status: 'EXEMPT', grade: 'M', fulfilledCode: x.condition.targetCourseCode, fulfilledName: course?.name ?? null } });
          }
        }
        // Ret sonrası bekleyen diğer imzalar düşer; form yeniden gönderildiğinde yeni tur açılır.
        if (status === 'REJECTED') {
          await tx.approval.updateMany({ where: { subjectType: a.subjectType, subjectId: a.subjectId, round: a.round, decision: 'PENDING' }, data: { decision: 'REJECTED', comment: 'Başka bir imzacı reddettiği için düştü' } });
        }
      }
      const entity = a.subjectType === 'PROTOCOL' ? 'Protocol' : a.subjectType === 'COURSE_REG' ? 'CourseRegistration' : 'ExemptionRequest';
      await this.audit.log({ actor: user.username, action: `APPROVAL_${decision}`, entity, entityId: a.subjectId, after: { role: a.role, round: a.round, proxy }, reason: note }, tx);
      return status;
    });

    if (result) {
      const what = LABELS.subject[a.subjectType];
      const title = `${what} ${result === 'APPROVED' ? 'imzaları tamamlandı' : 'reddedildi'}`;
      const body = result === 'APPROVED' ? `${e.student.fullName} (${e.studentNo}): ${what.toLowerCase()} için bütün imzalar tamamlandı.` : `${e.student.fullName} (${e.studentNo}): ${what.toLowerCase()} ${user.displayName} tarafından reddedildi: ${comment ?? ''}`;
      await this.notifications.notify(e.student.user.username, title, body, `/kayitlar/${e.id}`);
      await this.notifications.notifyCoordinators(title, body, `/kayitlar/${e.id}`);
    }
    return { ok: true, formStatus: result };
  }

  approvalsFor(type: ApprovalSubject, id: string) {
    return this.prisma.approval.findMany({ where: { subjectType: type, subjectId: id }, orderBy: [{ round: 'desc' }, { createdAt: 'asc' }] });
  }
}
