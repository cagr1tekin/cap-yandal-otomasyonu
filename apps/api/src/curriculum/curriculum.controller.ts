import { Body, Controller, Get, Injectable, Param, Patch, Post, Put } from '@nestjs/common';
import {
  AttemptCorrectSchema,
  AttemptCreateSchema,
  BackfillSchema,
  CourseRequestDecisionSchema,
  CourseRequestSchema,
  ExemptSchema,
  GradeSubmissionSchema,
  PlanAddSchema,
  PlanFromTemplateSchema,
  ReasonSchema,
  TemplateSaveSchema,
  type TemplateSaveInput,
} from '@cap/contracts';
import { evaluate, type RuleResult, type TrackType } from '@cap/rules';
import type { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog';
import { conflict, notFound, unprocessable, ZodPipe } from '../common/http';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from '../rules/rules.service';
import { CurriculumService } from './curriculum.service';

/** Katalogda olmayan ders için öğrenci talebi; koordinatör kataloğa ekleyip onaylar ya da reddeder. */
@Injectable()
export class CourseRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
    private readonly curriculum: CurriculumService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthUser, studentNo: string, input: z.infer<typeof CourseRequestSchema>) {
    await this.access.writable(user, studentNo);
    if (user.role !== 'OGRENCI') throw conflict('Ders talebini öğrenci gönderir; koordinatör dersi doğrudan kataloğa ekler.');
    const r = await this.prisma.courseRequest.create({ data: { studentNo, code: input.code ?? null, name: input.name, note: input.note } });
    await this.audit.log(user, { action: 'COURSE_REQUEST', entity: 'CourseRequest', entityId: r.id, studentNo, after: input });
    await this.notifications.notifyCoordinators('Katalog dışı ders talebi', `${studentNo}: ${input.code ?? ''} ${input.name}`, '/katalog?sekme=talepler');
    return r;
  }

  list() {
    return this.prisma.courseRequest.findMany({ include: { student: { select: { fullName: true, track: true } } }, orderBy: { createdAt: 'desc' }, take: 300 });
  }

  async review(user: AuthUser, id: string, input: z.infer<typeof CourseRequestDecisionSchema>) {
    this.access.assertCoordinator(user);
    const r = await this.prisma.courseRequest.findUnique({ where: { id }, include: { student: { include: { user: true } } } });
    if (!r) throw notFound('Ders talebi');
    if (r.status !== 'PENDING') throw conflict('Bu talep için zaten karar verildi.');
    if (input.decision === 'REJECTED' && (input.note?.length ?? 0) < 5) throw unprocessable('Ret için gerekçe yazın.');
    if (input.decision === 'APPROVED') {
      if (!input.courseCode) throw unprocessable('Onay için dersin katalogdaki kodunu seçin (önce kataloğa ekleyin).');
      await this.catalog.course(input.courseCode);
    }
    await this.prisma.courseRequest.update({ where: { id }, data: { status: input.decision, reviewedBy: user.username, reviewedAt: new Date(), reviewNote: input.note ?? null, courseCode: input.courseCode ?? null } });
    await this.audit.log(user, { action: `COURSE_REQUEST_${input.decision}`, entity: 'CourseRequest', entityId: id, studentNo: r.studentNo, after: input, reason: input.note });
    if (input.decision === 'APPROVED' && input.addToPlan) {
      await this.curriculum.addPlanItem(user, r.studentNo, { courseCode: input.courseCode!, reason: `Ders talebi onayı${input.note ? `: ${input.note}` : ''}` });
    }
    if (r.student.user) {
      await this.notifications.notify(
        r.student.user.username,
        input.decision === 'APPROVED' ? 'Ders talebiniz onaylandı' : 'Ders talebiniz reddedildi',
        input.decision === 'APPROVED' ? `${input.courseCode} kataloğa eklendi${input.addToPlan ? ' ve listenize işlendi' : ''}.` : `${r.name}: ${input.note}`,
        `/ogrenciler/${r.studentNo}?sekme=dersler`,
      );
    }
    return { ok: true, studentNo: r.studentNo, label: `${r.code ?? ''} ${r.name}`.trim() };
  }
}

/**
 * Ders listesi şablonları (bölüm sitesindeki Kabul ve Ders Protokolleri). Şablon değiştiğinde eski satırlar
 * pasife alınır (silinmez); öğrenci listeleri şablondan bağımsızdır.
 */
@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly audit: AuditService,
  ) {}

  async check(type: TrackType, ects: number, count: number, commonEcts: number): Promise<RuleResult[]> {
    const { def } = await this.rules.active(type);
    return evaluate(def, 'PROTOCOL', {
      protocol: { level: 'LISANS', durationYears: 4, courseEcts: ects, courseCount: count, commonEcts, overlapCodes: [] },
      minorPlan: { poolEcts: 9999, planEcts: ects, planCourseCount: count },
    }).results.filter((r) => r.status !== 'NOT_APPLICABLE');
  }

  async list() {
    const rows = await this.prisma.protocolTemplate.findMany({ include: { sourceProgram: true, items: { where: { active: true }, orderBy: { position: 'asc' } }, conditions: { orderBy: { no: 'asc' } } }, orderBy: [{ type: 'asc' }, { title: 'asc' }] });
    return Promise.all(
      rows.map(async (t) => {
        const ects = t.items.reduce((s, i) => s + i.ects, 0);
        const results = await this.check(t.type, ects, t.items.length, t.commonEcts);
        return { ...t, ects, totalEcts: ects + t.commonEcts, results, ok: results.every((r) => r.status !== 'FAIL') };
      }),
    );
  }

  async get(id: string) {
    const t = (await this.list()).find((x) => x.id === id);
    if (!t) throw notFound('Şablon');
    return t;
  }

  async save(user: AuthUser, id: string | null, input: TemplateSaveInput) {
    if (input.type === 'CAP' && !input.sourceProgramId) throw unprocessable('ÇAP şablonu için ana dal bölümünü seçin.');
    const codes = input.items.filter((i) => i.kind === 'COURSE').map((i) => i.code ?? '');
    if (codes.some((c) => !c)) throw unprocessable('Ders satırlarında ders kodu zorunludur.');
    const known = await this.prisma.course.findMany({ where: { code: { in: [...codes, ...input.conditions.map((c) => c.targetCourseCode)] } } });
    const unknown = [...codes, ...input.conditions.map((c) => c.targetCourseCode)].filter((c) => !known.some((k) => k.code === c));
    if (unknown.length) throw unprocessable(`Katalogda olmayan ders: ${[...new Set(unknown)].join(', ')}`);
    const existing = id ? await this.prisma.protocolTemplate.findUnique({ where: { id } }) : null;
    if (id && !existing) throw notFound('Şablon');
    if (!existing && (await this.prisma.protocolTemplate.findFirst({ where: { type: input.type, sourceProgramId: input.sourceProgramId } }))) {
      throw conflict('Bu bölüm için şablon zaten var; onu düzenleyin.');
    }
    const saved = await this.prisma.$transaction(async (tx) => {
      const head = { type: input.type, sourceProgramId: input.sourceProgramId, title: input.title, commonEcts: input.commonEcts, updatedBy: user.username };
      const t = existing ? await tx.protocolTemplate.update({ where: { id: existing.id }, data: head }) : await tx.protocolTemplate.create({ data: head });
      await tx.protocolTemplateItem.updateMany({ where: { templateId: t.id, active: true }, data: { active: false } });
      await tx.protocolTemplateItem.createMany({ data: input.items.map((i, position) => ({ templateId: t.id, position, kind: i.kind, code: i.kind === 'COURSE' ? i.code! : null, name: i.name, ects: i.ects, semester: i.semester })) });
      for (const c of input.conditions) {
        const data = { sourceCourseCode: c.sourceCourseCode, sourceCourseName: c.sourceCourseName, targetCourseCode: c.targetCourseCode, note: c.note || null };
        await tx.protocolCondition.upsert({ where: { templateId_no: { templateId: t.id, no: c.no } }, create: { templateId: t.id, no: c.no, ...data }, update: data });
      }
      await this.audit.log(user, { action: existing ? 'TEMPLATE_UPDATE' : 'TEMPLATE_CREATE', entity: 'ProtocolTemplate', entityId: t.id, after: { items: input.items.length, conditions: input.conditions.length, commonEcts: input.commonEcts } }, tx);
      return t;
    });
    return this.get(saved.id);
  }
}

@Controller()
export class CurriculumController {
  constructor(
    private readonly curriculum: CurriculumService,
    private readonly requests: CourseRequestsService,
    private readonly templates: TemplatesService,
  ) {}

  @Post('students/:no/plan')
  addPlan(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(PlanAddSchema)) body: z.infer<typeof PlanAddSchema>) {
    return this.curriculum.addPlanItem(user, no, body);
  }

  @Post('students/:no/plan/template')
  @Roles('KOORDINATOR')
  fromTemplate(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(PlanFromTemplateSchema)) body: z.infer<typeof PlanFromTemplateSchema>) {
    return this.curriculum.applyTemplate(user, no, body.templateId, body.reason);
  }

  @Post('plan-items/:id/remove')
  @Roles('KOORDINATOR')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ReasonSchema)) body: { reason: string }) {
    return this.curriculum.removePlanItem(user, id, body.reason);
  }

  @Post('plan-items/:id/exempt')
  @Roles('KOORDINATOR')
  exempt(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ExemptSchema)) body: z.infer<typeof ExemptSchema>) {
    return this.curriculum.exempt(user, id, body);
  }

  @Post('plan-items/:id/unexempt')
  @Roles('KOORDINATOR')
  unexempt(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ReasonSchema)) body: { reason: string }) {
    return this.curriculum.unexempt(user, id, body.reason);
  }

  @Post('plan-items/:id/cancel')
  cancelPlan(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ReasonSchema)) body: { reason: string }) {
    return this.curriculum.cancel(user, 'plan', id, body.reason);
  }

  @Post('students/:no/attempts')
  addAttempt(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(AttemptCreateSchema)) body: z.infer<typeof AttemptCreateSchema>) {
    return this.curriculum.addAttempt(user, no, body);
  }

  @Post('students/:no/attempts/backfill')
  @Roles('KOORDINATOR')
  backfill(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(BackfillSchema)) body: z.infer<typeof BackfillSchema>) {
    return this.curriculum.backfill(user, no, body);
  }

  @Patch('attempts/:id')
  @Roles('KOORDINATOR')
  correct(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(AttemptCorrectSchema)) body: z.infer<typeof AttemptCorrectSchema>) {
    return this.curriculum.correctAttempt(user, id, body);
  }

  @Post('attempts/:id/cancel')
  cancelAttempt(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ReasonSchema)) body: { reason: string }) {
    return this.curriculum.cancel(user, 'attempt', id, body.reason);
  }

  @Post('students/:no/grade-submissions')
  submitGrades(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(GradeSubmissionSchema)) body: z.infer<typeof GradeSubmissionSchema>) {
    return this.curriculum.submitGrades(user, no, body);
  }

  @Post('grade-submissions/:id/cancel')
  cancelGrades(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ReasonSchema)) body: { reason: string }) {
    return this.curriculum.cancel(user, 'grades', id, body.reason);
  }

  @Post('students/:no/course-requests')
  @Roles('OGRENCI')
  requestCourse(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(CourseRequestSchema)) body: z.infer<typeof CourseRequestSchema>) {
    return this.requests.create(user, no, body);
  }

  @Get('course-requests')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  courseRequests() {
    return this.requests.list();
  }

  @Post('course-requests/:id/review')
  @Roles('KOORDINATOR')
  reviewRequest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(CourseRequestDecisionSchema)) body: z.infer<typeof CourseRequestDecisionSchema>) {
    return this.requests.review(user, id, body);
  }

  @Get('protocol-templates')
  listTemplates() {
    return this.templates.list();
  }

  @Get('protocol-templates/:id')
  template(@Param('id') id: string) {
    return this.templates.get(id);
  }

  @Post('protocol-templates')
  @Roles('KOORDINATOR')
  createTemplate(@CurrentUser() user: AuthUser, @Body(new ZodPipe(TemplateSaveSchema)) body: TemplateSaveInput) {
    return this.templates.save(user, null, body);
  }

  @Put('protocol-templates/:id')
  @Roles('KOORDINATOR')
  updateTemplate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(TemplateSaveSchema)) body: TemplateSaveInput) {
    return this.templates.save(user, id, body);
  }
}
