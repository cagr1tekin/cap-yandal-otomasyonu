import { Body, Controller, Get, Injectable, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  ContactSchema,
  DecisionSchema,
  GanoSchema,
  LABELS,
  LeaveSchema,
  ReasonSchema,
  StudentCreateSchema,
  StudentUpdateSchema,
  type DecisionType,
  type StudentCreateInput,
  type StudentStatus,
} from '@cap/contracts';
import type { Prisma, RecordSource } from '@prisma/client';
import type { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog';
import { conflict, notFound, unprocessable, ZodPipe } from '../common/http';
import { CurriculumService } from '../curriculum/curriculum.service';
import { itemState, totals } from '../curriculum/progress';
import { IdentityPort } from '../identity/identity';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { ChecksService, toLike } from '../rules/checks.service';

type Tx = Prisma.TransactionClient | PrismaService;

const DECISION_STATUS: Record<DecisionType, StudentStatus> = {
  MEZUNIYET: 'GRADUATED',
  SERTIFIKA: 'CERTIFIED',
  KAYIT_SILME: 'REMOVED',
  AYRILMA: 'WITHDRAWN',
  DONDURMA: 'FROZEN',
  ETKINLESTIRME: 'ACTIVE',
};

/**
 * Öğrenci kartı. Kabul edilen öğrenciyi koordinatör ekler (başvuru değerlendirmesi dekanlıktadır).
 * Öğrenci numarası benzersiz anahtardır; elle giriş ve dışarıdan aktarım create() yönteminden geçer.
 */
@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
    private readonly identity: IdentityPort,
    private readonly curriculum: CurriculumService,
    private readonly checks: ChecksService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthUser, input: StudentCreateInput, source: RecordSource = 'COORDINATOR', tx: Tx = this.prisma) {
    this.access.assertCoordinator(user);
    await this.catalog.term(input.admissionTermId);
    if (input.mainProgramId) {
      const p = await tx.program.findUnique({ where: { id: input.mainProgramId } });
      if (!p || p.isHome) throw unprocessable('Ana dal bölümü geçersiz; Bilgisayar Mühendisliği öğrencisi kendi bölümünde ÇAP / YDP yapamaz.');
    }
    if (await tx.student.findUnique({ where: { studentNo: input.studentNo } })) throw conflict(`${input.studentNo} numaralı öğrenci zaten kayıtlı.`);
    const taken = await tx.user.findFirst({ where: { OR: [{ username: input.studentNo }, { email: input.schoolEmail }] } });
    if (taken) throw conflict('Bu öğrenci numarası ya da e-posta başka bir hesapta kayıtlı.');

    // Önce kimlik servisinde hesap açılır; başarısız olursa öğrenci kaydı da oluşmaz.
    await this.identity.ensure({ username: input.studentNo, email: input.schoolEmail, displayName: input.fullName });
    const s = await (tx === this.prisma ? this.prisma.$transaction((t) => this.insert(user, input, source, t)) : this.insert(user, input, source, tx));
    if (input.sendInvite) await this.invite(user, input.studentNo);
    return s;
  }

  private async insert(user: AuthUser, input: StudentCreateInput, source: RecordSource, tx: Prisma.TransactionClient | PrismaService) {
    const u = await tx.user.create({ data: { username: input.studentNo, displayName: input.fullName, email: input.schoolEmail, role: 'OGRENCI', createdBy: user.username } });
    const s = await tx.student.create({
      data: {
        studentNo: input.studentNo,
        userId: u.id,
        fullName: input.fullName,
        schoolEmail: input.schoolEmail,
        track: input.track,
        admissionTermId: input.admissionTermId,
        mainProgramId: input.mainProgramId ?? null,
        commonEcts: input.commonEcts ?? 0,
        source,
        createdBy: user.username,
      },
    });
    await this.audit.log(user, { action: 'STUDENT_CREATE', entity: 'Student', entityId: s.studentNo, studentNo: s.studentNo, after: { ...input, source } }, tx);
    return s;
  }

  /** Şifre belirleme bağlantısını öğrencinin okul e-postasına gönderir. */
  async invite(user: AuthUser, username: string) {
    this.access.assertCoordinator(user);
    const u = await this.prisma.user.findUnique({ where: { username } });
    if (!u) throw notFound('Hesap');
    if (!u.active) throw conflict('Pasif hesaba davet gönderilmez.');
    await this.identity.invite(username);
    await this.prisma.user.update({ where: { id: u.id }, data: { invitedAt: new Date() } });
    await this.audit.log(user, { action: 'ACCOUNT_INVITE', entity: 'User', entityId: u.id, studentNo: u.role === 'OGRENCI' ? username : null });
    return { ok: true };
  }

  async update(user: AuthUser, studentNo: string, input: z.infer<typeof StudentUpdateSchema>) {
    this.access.assertCoordinator(user);
    const before = await this.access.student(user, studentNo);
    const { reason, ...data } = input;
    if (data.admissionTermId) await this.catalog.term(data.admissionTermId);
    if (data.schoolEmail && data.schoolEmail !== before.schoolEmail) {
      const clash = await this.prisma.user.findFirst({ where: { email: data.schoolEmail, NOT: { id: before.userId ?? '' } } });
      if (clash) throw conflict('Bu e-posta başka bir hesapta kayıtlı.');
      await this.identity.ensure({ username: studentNo, email: data.schoolEmail, displayName: data.fullName ?? before.fullName });
    }
    const s = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({ where: { studentNo }, data });
      if (before.userId && (data.fullName || data.schoolEmail)) {
        await tx.user.update({ where: { id: before.userId }, data: { ...(data.fullName ? { displayName: data.fullName } : {}), ...(data.schoolEmail ? { email: data.schoolEmail } : {}) } });
      }
      await this.audit.log(user, { action: 'STUDENT_UPDATE', entity: 'Student', entityId: studentNo, studentNo, before, after: data, reason }, tx);
      return updated;
    });
    if (data.track || data.admissionTermId || data.commonEcts !== undefined) await this.checks.run(studentNo, 'KART_GUNCELLENDI', user);
    return s;
  }

  /** Öğrencinin kendi değiştirebildiği tek alan: telefon. */
  async contact(user: AuthUser, studentNo: string, phone?: string) {
    const before = await this.access.writable(user, studentNo, { activeOnly: false });
    await this.prisma.student.update({ where: { studentNo }, data: { phone: phone || null } });
    await this.audit.log(user, { action: 'STUDENT_CONTACT', entity: 'Student', entityId: studentNo, studentNo, before: { phone: before.phone }, after: { phone } });
    return { ok: true };
  }

  async list(f: { q?: string; track?: string; status?: string; flag?: string }) {
    const rows = await this.prisma.student.findMany({
      where: {
        ...(f.track ? { track: f.track as 'CAP' | 'YANDAL' } : {}),
        ...(f.status ? { status: f.status as StudentStatus } : {}),
        ...(f.q ? { OR: [{ studentNo: { startsWith: f.q } }, { fullName: { contains: f.q, mode: 'insensitive' } }] } : {}),
      },
      include: {
        admissionTerm: true,
        mainProgram: true,
        user: { select: { invitedAt: true, lastLoginAt: true, active: true } },
        planItems: { include: { attempts: { include: { term: { select: { startsAt: true } } } } } },
        ruleChecks: { orderBy: { createdAt: 'desc' }, take: 1, select: { worst: true, createdAt: true, results: true } },
        _count: {
          select: {
            documents: { where: { status: 'PENDING' } },
            gradeSubmissions: { where: { status: 'PENDING' } },
            attempts: { where: { status: 'PENDING' } },
            courseRequests: { where: { status: 'PENDING' } },
          },
        },
      },
      orderBy: { studentNo: 'asc' },
    });
    const unread = await this.prisma.message.groupBy({ by: ['studentNo'], where: { readAt: null, sender: { role: 'OGRENCI' } }, _count: true });
    const out = rows.map((s) => {
      const t = totals(toLike(s.planItems));
      const pending = s._count.documents + s._count.gradeSubmissions + s._count.attempts + s._count.courseRequests + t.pendingItems;
      const check = s.ruleChecks[0];
      return {
        studentNo: s.studentNo,
        fullName: s.fullName,
        track: s.track,
        status: s.status,
        admissionTerm: s.admissionTerm,
        mainProgram: s.mainProgram?.name ?? null,
        account: s.user,
        totals: t,
        pending,
        unread: unread.find((u) => u.studentNo === s.studentNo)?._count ?? 0,
        worst: check?.worst ?? null,
        graduationReady: !!(check?.results as { graduationReady?: boolean } | undefined)?.graduationReady,
      };
    });
    if (f.flag === 'uyari') return out.filter((s) => s.worst === 'WARN' || s.worst === 'FAIL');
    if (f.flag === 'onay') return out.filter((s) => s.pending > 0);
    if (f.flag === 'mezuniyet') return out.filter((s) => s.graduationReady);
    return out;
  }

  /** Kart ayrıntısı: öğrenci ve personelin ortak görünümü; personel notları ayrıca ve yalnızca personele açılır. */
  async detail(user: AuthUser, studentNo: string) {
    await this.access.student(user, studentNo);
    const s = await this.prisma.student.findUniqueOrThrow({
      where: { studentNo },
      include: {
        admissionTerm: true,
        mainProgram: true,
        user: { select: { id: true, username: true, invitedAt: true, lastLoginAt: true, active: true } },
        ganoRecords: { include: { term: true }, orderBy: { term: { startsAt: 'desc' } } },
        leaves: { include: { term: true }, orderBy: { term: { startsAt: 'desc' } } },
        decisions: { orderBy: { decidedAt: 'desc' } },
        courseRequests: { orderBy: { createdAt: 'desc' } },
      },
    });
    const [items, submissions, gradeable, live, history, term, templates, terms] = await Promise.all([
      this.curriculum.planItems(studentNo),
      this.curriculum.gradeSubmissions(studentNo),
      this.curriculum.gradeable(studentNo),
      this.checks.compute(studentNo),
      this.checks.history(studentNo),
      this.catalog.currentTerm(),
      this.prisma.protocolTemplate.findMany({ where: { type: s.track }, select: { id: true, title: true, sourceProgramId: true, conditions: { orderBy: { no: 'asc' } } } }),
      this.prisma.term.findMany({ orderBy: { startsAt: 'asc' } }),
    ]);
    const like = toLike(items);
    const coord = user.role === 'KOORDINATOR';
    const own = user.studentNo === studentNo;
    const active = s.status === 'ACTIVE';
    return {
      student: {
        ...s,
        user: this.access.isStaff(user) ? s.user : undefined,
        // GANO kaydını öğrenci de görür; kaynağı ve notu yalnızca personele açıktır.
        ganoRecords: s.ganoRecords.map((g) => (this.access.isStaff(user) ? g : { ...g, sourceNote: null, enteredBy: null })),
      },
      planItems: items.map((it, i) => ({ ...it, state: itemState(like[i]) })),
      totals: totals(like),
      gradeSubmissions: submissions,
      gradeable,
      live,
      checks: history,
      currentTerm: term,
      terms,
      templates,
      can: {
        coordinator: coord,
        editPlan: (own && active) || coord,
        addAttempt: (own && active) || coord,
        submitGrades: (own && active) || coord,
        upload: own || coord,
        message: own || coord,
        requestCourse: own && active,
      },
    };
  }

  // ---------------- GANO, izin ----------------

  /** Ana dal GANO'su yalnızca koordinatörce, kaynağıyla girilir. Düzeltme için eski kayıt iptal edilir. */
  async addGano(user: AuthUser, studentNo: string, input: z.infer<typeof GanoSchema>) {
    this.access.assertCoordinator(user);
    await this.access.student(user, studentNo);
    await this.catalog.term(input.termId);
    const dup = await this.prisma.ganoRecord.findFirst({ where: { studentNo, termId: input.termId, cancelledAt: null } });
    if (dup) throw conflict('Bu dönem için GANO kaydı var; düzeltmek için önce gerekçeyle iptal edin.');
    const g = await this.prisma.ganoRecord.create({ data: { studentNo, ...input, sourceNote: input.sourceNote ?? null, enteredBy: user.username } });
    await this.audit.log(user, { action: 'GANO_ADD', entity: 'GanoRecord', entityId: g.id, studentNo, after: input });
    await this.checks.run(studentNo, 'GANO', user);
    return g;
  }

  async cancelGano(user: AuthUser, id: string, reason: string) {
    this.access.assertCoordinator(user);
    const g = await this.prisma.ganoRecord.findUnique({ where: { id } });
    if (!g) throw notFound('GANO kaydı');
    if (g.cancelledAt) throw conflict('Kayıt zaten iptal edilmiş.');
    await this.prisma.ganoRecord.update({ where: { id }, data: { cancelledAt: new Date(), cancelledBy: user.username, cancelReason: reason } });
    await this.audit.log(user, { action: 'GANO_CANCEL', entity: 'GanoRecord', entityId: id, studentNo: g.studentNo, before: { gano: g.gano, termId: g.termId }, reason });
    await this.checks.run(g.studentNo, 'GANO', user);
    return { ok: true };
  }

  async addLeave(user: AuthUser, studentNo: string, input: z.infer<typeof LeaveSchema>) {
    this.access.assertCoordinator(user);
    await this.access.student(user, studentNo);
    await this.catalog.term(input.termId);
    const l = await this.prisma.termLeave.create({ data: { studentNo, termId: input.termId, reason: input.reason, note: input.note ?? null, createdBy: user.username } });
    await this.audit.log(user, { action: 'LEAVE_ADD', entity: 'TermLeave', entityId: l.id, studentNo, after: input });
    await this.checks.run(studentNo, 'DONEM_IZNI', user);
    return l;
  }

  async cancelLeave(user: AuthUser, id: string, reason: string) {
    this.access.assertCoordinator(user);
    const l = await this.prisma.termLeave.findUnique({ where: { id } });
    if (!l) throw notFound('Dönem izni');
    if (l.cancelledAt) throw conflict('İzin zaten iptal edilmiş.');
    await this.prisma.termLeave.update({ where: { id }, data: { cancelledAt: new Date(), cancelledBy: user.username, cancelReason: reason } });
    await this.audit.log(user, { action: 'LEAVE_CANCEL', entity: 'TermLeave', entityId: id, studentNo: l.studentNo, reason });
    await this.checks.run(l.studentNo, 'DONEM_IZNI', user);
    return { ok: true };
  }

  // ---------------- Kararlar ----------------

  /** Mezuniyet, sertifika, kayıt silme vb. Kararı koordinatör verir; karar anındaki kural kontrolü kayda bağlanır. */
  async decide(user: AuthUser, studentNo: string, input: z.infer<typeof DecisionSchema>) {
    this.access.assertCoordinator(user);
    const s = await this.prisma.student.findUnique({ where: { studentNo }, include: { user: true } });
    if (!s) throw notFound('Öğrenci');
    if (input.type === 'MEZUNIYET' && s.track !== 'CAP') throw unprocessable('Mezuniyet (diploma) kararı ÇAP öğrencisi içindir; YDP için sertifika kararı verin.');
    if (input.type === 'SERTIFIKA' && s.track !== 'YANDAL') throw unprocessable('Sertifika kararı YDP öğrencisi içindir.');
    const newStatus = DECISION_STATUS[input.type];
    if (s.status === newStatus) throw conflict(`Öğrenci zaten "${LABELS.studentStatus[newStatus]}" durumunda.`);
    const { check } = await this.checks.run(studentNo, `KARAR_${input.type}`, user);
    const d = await this.prisma.$transaction(async (tx) => {
      const decision = await tx.studentDecision.create({
        data: { studentNo, type: input.type, reason: input.reason, reference: input.reference ?? null, ruleCheckId: input.ruleCheckId ?? check.id, previousStatus: s.status, newStatus, decidedBy: user.username },
      });
      await tx.student.update({ where: { studentNo }, data: { status: newStatus } });
      await this.audit.log(user, { action: `DECISION_${input.type}`, entity: 'StudentDecision', entityId: decision.id, studentNo, before: { status: s.status }, after: { status: newStatus, reference: input.reference, ruleCheckId: decision.ruleCheckId }, reason: input.reason }, tx);
      return decision;
    });
    if (s.user) await this.notifications.notify(s.user.username, `Karar: ${LABELS.decision[input.type]}`, `${input.reason}${input.reference ? ` (${input.reference})` : ''}`, `/ogrenciler/${studentNo}`);
    return d;
  }

  async cancelDecision(user: AuthUser, id: string, reason: string) {
    this.access.assertCoordinator(user);
    const d = await this.prisma.studentDecision.findUnique({ where: { id }, include: { student: true } });
    if (!d) throw notFound('Karar');
    if (d.cancelledAt) throw conflict('Karar zaten iptal edilmiş.');
    if (d.student.status !== d.newStatus) throw conflict('Öğrencinin durumu bu karardan sonra değişmiş; son kararı iptal edin.');
    await this.prisma.$transaction(async (tx) => {
      await tx.studentDecision.update({ where: { id }, data: { cancelledAt: new Date(), cancelledBy: user.username, cancelReason: reason } });
      await tx.student.update({ where: { studentNo: d.studentNo }, data: { status: d.previousStatus } });
      await this.audit.log(user, { action: 'DECISION_CANCEL', entity: 'StudentDecision', entityId: id, studentNo: d.studentNo, before: { status: d.newStatus }, after: { status: d.previousStatus }, reason }, tx);
    });
    return { ok: true };
  }

  /** Kartın işlem geçmişi (personel). */
  async history(user: AuthUser, studentNo: string) {
    if (!this.access.isStaff(user)) throw notFound('Kayıt');
    await this.access.student(user, studentNo);
    return this.audit.list({ studentNo }, 300);
  }
}

@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  list(@Query('q') q?: string, @Query('track') track?: string, @Query('status') status?: string, @Query('flag') flag?: string) {
    return this.students.list({ q, track, status, flag });
  }

  @Post()
  @Roles('KOORDINATOR')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(StudentCreateSchema)) body: StudentCreateInput) {
    return this.students.create(user, body);
  }

  @Get(':no')
  detail(@CurrentUser() user: AuthUser, @Param('no') no: string) {
    return this.students.detail(user, no);
  }

  @Patch(':no')
  @Roles('KOORDINATOR')
  update(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(StudentUpdateSchema)) body: z.infer<typeof StudentUpdateSchema>) {
    return this.students.update(user, no, body);
  }

  @Put(':no/contact')
  contact(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(ContactSchema)) body: { phone?: string }) {
    return this.students.contact(user, no, body.phone);
  }

  @Post(':no/invite')
  @Roles('KOORDINATOR')
  invite(@CurrentUser() user: AuthUser, @Param('no') no: string) {
    return this.students.invite(user, no);
  }

  @Post(':no/gano')
  @Roles('KOORDINATOR')
  gano(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(GanoSchema)) body: z.infer<typeof GanoSchema>) {
    return this.students.addGano(user, no, body);
  }

  @Post(':no/leaves')
  @Roles('KOORDINATOR')
  leave(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(LeaveSchema)) body: z.infer<typeof LeaveSchema>) {
    return this.students.addLeave(user, no, body);
  }

  @Post(':no/decisions')
  @Roles('KOORDINATOR')
  decide(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(DecisionSchema)) body: z.infer<typeof DecisionSchema>) {
    return this.students.decide(user, no, body);
  }

  @Get(':no/history')
  history(@CurrentUser() user: AuthUser, @Param('no') no: string) {
    return this.students.history(user, no);
  }
}

@Controller()
export class StudentRecordsController {
  constructor(private readonly students: StudentsService) {}

  @Post('gano/:id/cancel')
  @Roles('KOORDINATOR')
  cancelGano(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ReasonSchema)) body: { reason: string }) {
    return this.students.cancelGano(user, id, body.reason);
  }

  @Post('leaves/:id/cancel')
  @Roles('KOORDINATOR')
  cancelLeave(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ReasonSchema)) body: { reason: string }) {
    return this.students.cancelLeave(user, id, body.reason);
  }

  @Post('decisions/:id/cancel')
  @Roles('KOORDINATOR')
  cancelDecision(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ReasonSchema)) body: { reason: string }) {
    return this.students.cancelDecision(user, id, body.reason);
  }
}
