import { Injectable } from '@nestjs/common';
import { evaluate, type TrackType } from '@cap/rules';
import type { OfferingInput } from '@cap/contracts';
import type { Offering, Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { OfferingPatchSchema, YearStatSchema } from '@cap/contracts';
import type { AuthUser } from '../auth/auth';
import { AuditService } from '../audit/audit.service';
import { badRequest, conflict, notFound } from '../common/http';
import { PrismaService } from '../prisma/prisma.service';
import { ContextService, type OfferingWithSources } from '../rules/context.service';
import { RulesService } from '../rules/rules.service';

export const offeringInclude = {
  term: true,
  sourcePrograms: { include: { program: true } },
} satisfies Prisma.OfferingInclude;

export type OfferingFull = Prisma.OfferingGetPayload<{ include: typeof offeringInclude }>;

/** Başvuru takvimi durumu: tarihler teklifin kendisindedir (tek bölüm, tek takvim). */
export function windowState(o: Pick<Offering, 'opensAt' | 'closesAt' | 'announceAt' | 'status'>, now = new Date()) {
  const phase = o.status !== 'PUBLISHED' && now <= o.closesAt ? ('TASLAK' as const) : now < o.opensAt ? ('ONCE' as const) : now > o.closesAt ? ('KAPANDI' as const) : ('ACIK' as const);
  return { open: phase === 'ACIK', phase, opensAt: o.opensAt, closesAt: o.closesAt, announceAt: o.announceAt };
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rules: RulesService,
    private readonly context: ContextService,
  ) {}

  currentTerm() {
    return this.prisma.term.findFirst({ where: { isCurrent: true } });
  }

  async getOffering(id: string): Promise<OfferingFull> {
    const o = await this.prisma.offering.findUnique({ where: { id }, include: offeringInclude });
    if (!o) throw notFound('Teklif');
    return o;
  }

  list(filter: { termId?: string; type?: TrackType }) {
    return this.prisma.offering.findMany({
      where: { ...(filter.termId ? { termId: filter.termId } : {}), ...(filter.type ? { type: filter.type } : {}) },
      include: { ...offeringInclude, _count: { select: { applications: true, enrollments: true } } },
      orderBy: [{ term: { startsAt: 'desc' } }, { type: 'asc' }],
    });
  }

  /** KR-ÇAP-09 gibi yapılandırma kurallarının uyarıları. */
  async configurationWarnings(o: OfferingWithSources) {
    const { def } = await this.rules.active(o.type);
    const snapshot = await this.context.offering(o, null);
    return evaluate(def, 'CONFIGURATION', { offering: snapshot }).results.filter((r) => r.status === 'WARN');
  }

  private assertDates(input: { opensAt?: Date; closesAt?: Date }) {
    if (input.opensAt && input.closesAt && input.closesAt <= input.opensAt) throw badRequest('Başvuru bitişi başlangıçtan sonra olmalı.');
  }

  async create(input: OfferingInput, user: AuthUser) {
    this.assertDates(input);
    const exists = await this.prisma.offering.findUnique({ where: { termId_type: { termId: input.termId, type: input.type } } });
    if (exists) throw conflict('Bu dönem için bu türde teklif zaten var; mevcut teklifi düzenleyin.');
    const created = await this.prisma.offering.create({
      data: {
        termId: input.termId,
        type: input.type,
        quota: input.quota,
        firstYearIntake: input.firstYearIntake ?? null,
        quotaJustification: input.quotaJustification,
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        announceAt: input.announceAt,
        registrationDeadline: input.registrationDeadline,
        waitlistDeadline: input.waitlistDeadline,
        sourcePrograms: { create: input.sourceProgramIds.map((programId) => ({ programId })) },
      },
      include: offeringInclude,
    });
    await this.audit.log({ actor: user.username, action: 'OFFERING_CREATE', entity: 'Offering', entityId: created.id, after: input });
    return { offering: created, warnings: await this.configurationWarnings(created) };
  }

  async update(id: string, patch: z.infer<typeof OfferingPatchSchema>, user: AuthUser) {
    const before = await this.getOffering(id);
    this.assertDates({ opensAt: patch.opensAt ?? before.opensAt, closesAt: patch.closesAt ?? before.closesAt });
    if (before.rankingLockedAt && (patch.quota !== undefined || patch.sourceProgramIds)) {
      throw conflict('Sıralama kilitlendikten sonra kontenjan ve kaynak bölümler değiştirilemez.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      if (patch.sourceProgramIds) {
        await tx.offeringSourceProgram.deleteMany({ where: { offeringId: id } });
        await tx.offeringSourceProgram.createMany({ data: patch.sourceProgramIds.map((programId) => ({ offeringId: id, programId })) });
      }
      return tx.offering.update({
        where: { id },
        data: {
          quota: patch.quota,
          firstYearIntake: patch.firstYearIntake,
          quotaJustification: patch.quotaJustification,
          status: patch.status,
          opensAt: patch.opensAt,
          closesAt: patch.closesAt,
          announceAt: patch.announceAt,
          registrationDeadline: patch.registrationDeadline,
          waitlistDeadline: patch.waitlistDeadline,
        },
        include: offeringInclude,
      });
    });
    await this.audit.log({
      actor: user.username,
      action: 'OFFERING_UPDATE',
      entity: 'Offering',
      entityId: id,
      before: { quota: before.quota, status: before.status, opensAt: before.opensAt, closesAt: before.closesAt },
      after: patch,
    });
    return { offering: updated, warnings: await this.configurationWarnings(updated) };
  }

  /** Başvuruyu hemen kapatır (değerlendirmeye geçmek için). */
  async closeNow(id: string, user: AuthUser) {
    const o = await this.getOffering(id);
    const now = new Date();
    if (o.closesAt <= now) throw conflict('Başvuru dönemi zaten kapalı.');
    const updated = await this.prisma.offering.update({
      where: { id },
      data: { closesAt: now, opensAt: o.opensAt >= now ? new Date(now.getTime() - 1000) : o.opensAt },
    });
    await this.audit.log({ actor: user.username, action: 'OFFERING_CLOSE_NOW', entity: 'Offering', entityId: id, before: { closesAt: o.closesAt }, after: { closesAt: now } });
    return updated;
  }

  yearStats() {
    return this.prisma.yearStat.findMany({ orderBy: { year: 'desc' } });
  }

  async upsertYearStat(input: z.infer<typeof YearStatSchema>, user: AuthUser) {
    const before = await this.prisma.yearStat.findUnique({ where: { year: input.year } });
    const data = { baseScore: input.baseScore, successRankLimit: input.successRankLimit, updatedBy: user.username };
    const saved = await this.prisma.yearStat.upsert({ where: { year: input.year }, create: { year: input.year, ...data }, update: data });
    await this.audit.log({ actor: user.username, action: 'YEAR_STAT_UPSERT', entity: 'YearStat', entityId: String(input.year), before, after: input });
    return saved;
  }
}
