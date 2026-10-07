import { Injectable } from '@nestjs/common';
import { evaluate, type TrackType } from '@cap/rules';
import type { OfferingInput, WindowInput } from '@cap/contracts';
import type { ApplicationWindow, Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { badRequest, forbidden, notFound } from '../common/http';
import { PrismaService } from '../prisma/prisma.service';
import { ContextService, type OfferingWithProgram } from '../rules/context.service';
import { RulesService } from '../rules/rules.service';

export const offeringInclude = {
  program: { include: { unit: true } },
  term: true,
  sourcePrograms: { include: { program: true } },
  poolCourses: { orderBy: { courseCode: 'asc' as const } },
} satisfies Prisma.OfferingInclude;

export type OfferingFull = Prisma.OfferingGetPayload<{ include: typeof offeringInclude }>;

export function windowState(w: ApplicationWindow | null | undefined, now = new Date()) {
  if (!w) return { open: false, phase: 'TANIMSIZ' as const, opensAt: null, closesAt: null };
  const phase = now < w.opensAt ? ('ONCE' as const) : now > w.closesAt ? ('KAPANDI' as const) : ('ACIK' as const);
  return { open: phase === 'ACIK', phase, opensAt: w.opensAt, closesAt: w.closesAt, announceAt: w.announceAt };
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly rules: RulesService,
    private readonly context: ContextService,
  ) {}

  currentTerm() {
    return this.prisma.term.findFirst({ where: { isCurrent: true } });
  }

  async getOffering(id: string): Promise<OfferingFull> {
    const o = await this.prisma.offering.findUnique({ where: { id }, include: offeringInclude });
    if (!o) throw notFound('Program teklifi');
    return o;
  }

  window(unitId: string, termId: string, type: TrackType) {
    return this.prisma.applicationWindow.findUnique({ where: { unitId_termId_type: { unitId, termId, type } } });
  }

  async listForStaff(user: AuthUser, filter: { termId?: string; type?: TrackType }) {
    const where: Prisma.OfferingWhereInput = {
      AND: [this.access.offeringWhere(user), filter.termId ? { termId: filter.termId } : {}, filter.type ? { type: filter.type } : {}],
    };
    const offerings = await this.prisma.offering.findMany({
      where,
      include: { ...offeringInclude, _count: { select: { applications: true, enrollments: true } } },
      orderBy: [{ term: { startsAt: 'desc' } }, { program: { name: 'asc' } }],
    });
    return offerings;
  }

  /** KR-ÇAP-09 gibi yapılandırma kurallarının uyarıları. */
  async configurationWarnings(o: OfferingWithProgram) {
    const { def } = await this.rules.active(o.type);
    const snapshot = await this.context.offering(o, null);
    return evaluate(def, 'CONFIGURATION', { offering: snapshot }).results.filter((r) => r.status === 'WARN');
  }

  private assertCanManageProgram(user: AuthUser, program: { id: string; unitId: string }) {
    const ok =
      this.access.isOidb(user) ||
      this.access.unitIds(user).includes(program.unitId) ||
      this.access.programIds(user, 'BOLUM_BASKANI').includes(program.id);
    if (!ok) throw forbidden('Bu program için teklif tanımlama yetkiniz yok.');
  }

  async create(input: OfferingInput, user: AuthUser) {
    const program = await this.prisma.program.findUnique({ where: { id: input.programId } });
    if (!program) throw notFound('Program');
    this.assertCanManageProgram(user, program);
    if (input.type === 'YANDAL' && !(input.poolCourses?.length)) {
      throw badRequest('Yan dal teklifi için ders havuzu girilmelidir.');
    }
    const created = await this.prisma.offering.create({
      data: {
        programId: input.programId,
        termId: input.termId,
        type: input.type,
        quota: input.quota,
        coordinatorUsername: input.coordinatorUsername,
        firstYearIntake: input.firstYearIntake ?? null,
        quotaJustification: input.quotaJustification,
        sourcePrograms: { create: input.sourceProgramIds.map((programId) => ({ programId })) },
        poolCourses: { create: input.poolCourses ?? [] },
      },
      include: offeringInclude,
    });
    await this.audit.log({ actor: user.username, action: 'OFFERING_CREATE', entity: 'Offering', entityId: created.id, after: input });
    return { offering: created, warnings: await this.configurationWarnings(created) };
  }

  async update(id: string, patch: Partial<OfferingInput> & { status?: 'DRAFT' | 'PUBLISHED' | 'CLOSED' }, user: AuthUser) {
    const before = await this.getOffering(id);
    this.assertCanManageProgram(user, before.program);
    const warnings = await this.configurationWarnings({ ...before, ...('quota' in patch ? { quota: patch.quota! } : {}), firstYearIntake: patch.firstYearIntake ?? before.firstYearIntake });
    if (patch.status === 'PUBLISHED' && warnings.length && !(patch.quotaJustification ?? before.quotaJustification)) {
      throw badRequest('Asgari kontenjan uyarısı var; yayımlamak için kontenjan gerekçesi girilmelidir.', { warnings });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      if (patch.sourceProgramIds) {
        await tx.offeringSourceProgram.deleteMany({ where: { offeringId: id } });
        await tx.offeringSourceProgram.createMany({ data: patch.sourceProgramIds.map((programId) => ({ offeringId: id, programId })) });
      }
      if (patch.poolCourses) {
        await tx.minorPoolCourse.deleteMany({ where: { offeringId: id, planItems: { none: {} } } });
        for (const c of patch.poolCourses) {
          await tx.minorPoolCourse.upsert({
            where: { offeringId_courseCode: { offeringId: id, courseCode: c.courseCode } },
            create: { offeringId: id, ...c },
            update: { name: c.name, ects: c.ects },
          });
        }
      }
      return tx.offering.update({
        where: { id },
        data: {
          quota: patch.quota,
          coordinatorUsername: patch.coordinatorUsername,
          firstYearIntake: patch.firstYearIntake,
          quotaJustification: patch.quotaJustification,
          status: patch.status,
        },
        include: offeringInclude,
      });
    });
    await this.audit.log({
      actor: user.username,
      action: 'OFFERING_UPDATE',
      entity: 'Offering',
      entityId: id,
      before: { quota: before.quota, status: before.status, coordinatorUsername: before.coordinatorUsername },
      after: patch,
    });
    return { offering: updated, warnings };
  }

  async windows(user: AuthUser, termId: string) {
    const unitIds = this.access.isOidb(user) ? undefined : this.access.unitIds(user);
    return this.prisma.applicationWindow.findMany({
      where: { termId, ...(unitIds ? { unitId: { in: unitIds } } : {}) },
      include: { unit: true },
      orderBy: [{ unit: { name: 'asc' } }, { type: 'asc' }],
    });
  }

  async upsertWindow(unitId: string, input: WindowInput, user: AuthUser) {
    this.access.assertUnit(user, unitId);
    if (input.closesAt <= input.opensAt) throw badRequest('Kapanış tarihi açılıştan sonra olmalı.');
    const before = await this.window(unitId, input.termId, input.type);
    const w = await this.prisma.applicationWindow.upsert({
      where: { unitId_termId_type: { unitId, termId: input.termId, type: input.type } },
      create: { unitId, ...input },
      update: { opensAt: input.opensAt, closesAt: input.closesAt, announceAt: input.announceAt },
    });
    await this.audit.log({ actor: user.username, action: 'WINDOW_UPSERT', entity: 'ApplicationWindow', entityId: w.id, before, after: input });
    return w;
  }

  /** Gösterim kolaylığı: pencereyi hemen kapatır (değerlendirmeye geçmek için). */
  async closeWindowNow(unitId: string, termId: string, type: TrackType, user: AuthUser) {
    this.access.assertUnit(user, unitId);
    const w = await this.window(unitId, termId, type);
    if (!w) throw notFound('Başvuru takvimi');
    const now = new Date();
    const updated = await this.prisma.applicationWindow.update({
      where: { id: w.id },
      data: { closesAt: now, opensAt: w.opensAt > now ? now : w.opensAt },
    });
    await this.audit.log({ actor: user.username, action: 'WINDOW_CLOSE_NOW', entity: 'ApplicationWindow', entityId: w.id, before: w, after: updated });
    return updated;
  }
}
