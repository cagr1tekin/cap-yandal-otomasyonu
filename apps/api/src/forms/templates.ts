import { Body, Controller, Get, Injectable, Param, Post, Put } from '@nestjs/common';
import { evaluate, type RuleResult, type TrackType } from '@cap/rules';
import { TemplateSaveSchema, type TemplateSaveInput } from '@cap/contracts';
import type { Prisma } from '@prisma/client';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { conflict, notFound, unprocessable, ZodPipe } from '../common/http';
import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from '../rules/rules.service';

export const templateInclude = {
  sourceProgram: true,
  items: { orderBy: { position: 'asc' as const } },
  conditions: { orderBy: { no: 'asc' as const } },
} satisfies Prisma.ProtocolTemplateInclude;

export type TemplateFull = Prisma.ProtocolTemplateGetPayload<{ include: typeof templateInclude }>;

/**
 * Kabul ve Ders Protokolü şablonları. ÇAP'ta her ana dal bölümü için bir protokol vardır
 * (bölüm sitesindeki "Protokol - … Bilgisayara" belgeleri); yan dalda tek ders havuzu.
 */
@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly audit: AuditService,
  ) {}

  /** PROTOCOL aşaması kuralları: ÇAP'ta AKTS toplamı (m.7/2), yan dalda havuz ve plan sınırları (m.5/1-g). */
  async check(type: TrackType, courseEcts: number, courseCount: number, commonEcts: number, poolEcts: number): Promise<{ results: RuleResult[]; ok: boolean }> {
    const { def } = await this.rules.active(type);
    const outcome = evaluate(def, 'PROTOCOL', {
      protocol: { level: 'LISANS', durationYears: 4, courseEcts, courseCount, commonEcts, overlapCodes: [] },
      minorPlan: type === 'YANDAL' ? { poolEcts, planEcts: courseEcts, planCourseCount: courseCount } : undefined,
    });
    return { results: outcome.results.filter((r) => r.status !== 'NOT_APPLICABLE'), ok: outcome.verdict !== 'INELIGIBLE' };
  }

  private async shape(t: TemplateFull & { _count?: { protocols: number } }) {
    const ects = t.items.reduce((s, i) => s + i.ects, 0);
    // Yan dal havuzu, öğrenci planı için üst kümedir: yalnızca havuz büyüklüğü denetlenir.
    const check = t.type === 'CAP' ? await this.check('CAP', ects, t.items.length, t.commonEcts, 0) : await this.check('YANDAL', ects, t.items.length, 0, ects);
    return { ...t, ects, totalEcts: ects + t.commonEcts, results: check.results, ok: check.ok };
  }

  async list() {
    const rows = await this.prisma.protocolTemplate.findMany({ include: { ...templateInclude, _count: { select: { protocols: true } } }, orderBy: [{ type: 'asc' }, { title: 'asc' }] });
    return Promise.all(rows.map((t) => this.shape(t)));
  }

  async get(id: string) {
    const t = await this.prisma.protocolTemplate.findUnique({ where: { id }, include: { ...templateInclude, _count: { select: { protocols: true } } } });
    if (!t) throw notFound('Protokol şablonu');
    return this.shape(t);
  }

  /** Öğrencinin ana dal bölümüne göre uygulanacak şablon. */
  forStudent(type: TrackType, programId: string) {
    return this.prisma.protocolTemplate.findFirst({ where: type === 'CAP' ? { type, sourceProgramId: programId } : { type, sourceProgramId: null }, include: templateInclude });
  }

  async save(user: AuthUser, id: string | null, input: TemplateSaveInput) {
    if (input.type === 'YANDAL' && input.sourceProgramId) throw unprocessable('Yan dal ders havuzu bölüme göre ayrılmaz; ana dal bölümünü boş bırakın.');
    if (input.type === 'CAP' && !input.sourceProgramId) throw unprocessable('ÇAP protokolü için ana dal bölümünü seçin.');
    if (input.sourceProgramId) {
      const p = await this.prisma.program.findUnique({ where: { id: input.sourceProgramId } });
      if (!p || p.isHome) throw unprocessable('Ana dal bölümü geçersiz.');
    }

    const codes = input.items.filter((i) => i.kind === 'COURSE').map((i) => i.code ?? '');
    if (codes.some((c) => !c)) throw unprocessable('Ders satırlarında ders kodu zorunludur.');
    if (new Set(codes).size !== codes.length) throw unprocessable('Aynı ders protokolde iki kez yer alamaz.');
    const known = await this.prisma.course.findMany({ where: { code: { in: [...codes, ...input.conditions.map((c) => c.targetCourseCode)] } } });
    const unknown = [...codes, ...input.conditions.map((c) => c.targetCourseCode)].filter((c) => !known.some((k) => k.code === c));
    if (unknown.length) throw unprocessable(`Bilgisayar Mühendisliği müfredatında olmayan ders: ${[...new Set(unknown)].join(', ')}`);
    if (new Set(input.conditions.map((c) => c.no)).size !== input.conditions.length) throw unprocessable('Özel şart numaraları benzersiz olmalı.');

    const ects = input.items.reduce((s, i) => s + i.ects, 0);
    const check = input.type === 'CAP' ? await this.check('CAP', ects, input.items.length, input.commonEcts, 0) : await this.check('YANDAL', ects, input.items.length, 0, ects);
    if (!check.ok) throw unprocessable('Protokol kuralları sağlamıyor.', { results: check.results.filter((r) => r.status === 'FAIL') });

    const existing = id ? await this.prisma.protocolTemplate.findUnique({ where: { id }, include: templateInclude }) : null;
    if (id && !existing) throw notFound('Protokol şablonu');
    if (!existing) {
      const clash = await this.prisma.protocolTemplate.findFirst({ where: { type: input.type, sourceProgramId: input.sourceProgramId } });
      if (clash) throw conflict('Bu bölüm için zaten bir protokol şablonu var; onu düzenleyin.');
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const head = { type: input.type, sourceProgramId: input.sourceProgramId, title: input.title, commonEcts: input.commonEcts, updatedBy: user.username };
      const t = existing ? await tx.protocolTemplate.update({ where: { id: existing.id }, data: head }) : await tx.protocolTemplate.create({ data: head });
      await tx.protocolTemplateItem.deleteMany({ where: { templateId: t.id } });
      await tx.protocolTemplateItem.createMany({
        data: input.items.map((i, position) => ({ templateId: t.id, position, kind: i.kind, code: i.kind === 'COURSE' ? i.code! : null, name: i.name, ects: i.ects, semester: i.semester })),
      });
      // Muafiyet başvurusu bağlı özel şartlar silinemez; numarasına göre güncellenir.
      const keep = input.conditions.map((c) => c.no);
      const removable = await tx.protocolCondition.findMany({ where: { templateId: t.id, no: { notIn: keep } }, include: { _count: { select: { exemptions: true } } } });
      if (removable.some((c) => c._count.exemptions)) throw conflict('Muafiyet başvurusu bulunan özel şart kaldırılamaz.');
      await tx.protocolCondition.deleteMany({ where: { id: { in: removable.map((c) => c.id) } } });
      for (const c of input.conditions) {
        const data = { sourceCourseCode: c.sourceCourseCode, sourceCourseName: c.sourceCourseName, targetCourseCode: c.targetCourseCode, note: c.note || null };
        await tx.protocolCondition.upsert({ where: { templateId_no: { templateId: t.id, no: c.no } }, create: { templateId: t.id, no: c.no, ...data }, update: data });
      }
      await this.audit.log(
        { actor: user.username, action: existing ? 'TEMPLATE_UPDATE' : 'TEMPLATE_CREATE', entity: 'ProtocolTemplate', entityId: t.id, before: existing ? { items: existing.items.length, conditions: existing.conditions.length, commonEcts: existing.commonEcts } : undefined, after: { items: input.items.length, conditions: input.conditions.length, commonEcts: input.commonEcts, ects } },
        tx,
      );
      return t;
    });
    return this.get(saved.id);
  }
}

@Controller('protocol-templates')
export class TemplatesController {
  constructor(
    private readonly templates: TemplatesService,
    private readonly access: AccessService,
  ) {}

  @Get()
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  async list(@CurrentUser() user: AuthUser) {
    await this.access.assertDepartmentStaff(user);
    return this.templates.list();
  }

  @Get(':id')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.access.assertDepartmentStaff(user);
    return this.templates.get(id);
  }

  @Post()
  @Roles('KOORDINATOR')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(TemplateSaveSchema)) body: TemplateSaveInput) {
    return this.templates.save(user, null, body);
  }

  @Put(':id')
  @Roles('KOORDINATOR')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(TemplateSaveSchema)) body: TemplateSaveInput) {
    return this.templates.save(user, id, body);
  }
}
