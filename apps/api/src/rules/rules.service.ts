import { Injectable } from '@nestjs/common';
import { evaluate, type EvaluationContext, type RuleSetDefinition, type TrackType, type Verdict } from '@cap/rules';
import type { RuleDefinition, RuleSet } from '@prisma/client';
import type { z } from 'zod';
import type { RuleSetCreateSchema } from '@cap/contracts';
import type { AuthUser } from '../auth/auth';
import { AuditService } from '../audit/audit.service';
import { badRequest, conflict, notFound } from '../common/http';
import { PrismaService } from '../prisma/prisma.service';

type RuleSetRow = RuleSet & { rules: RuleDefinition[] };

export function toDefinition(rs: RuleSetRow): RuleSetDefinition {
  return {
    version: rs.version,
    type: rs.type,
    effectiveFrom: rs.effectiveFrom.toISOString().slice(0, 10),
    rules: [...rs.rules]
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        code: r.code,
        kind: r.kind,
        article: r.article,
        title: r.title,
        appliesTo: rs.type,
        phase: r.phase as RuleSetDefinition['rules'][number]['phase'],
        params: r.params as Record<string, unknown>,
      })),
  };
}

@Injectable()
export class RulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async active(type: TrackType): Promise<{ id: string; def: RuleSetDefinition }> {
    const rs = await this.prisma.ruleSet.findFirst({
      where: { type, status: 'ACTIVE', effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: 'desc' },
      include: { rules: true },
    });
    if (!rs) throw conflict(`${type} için etkin kural seti yok.`);
    return { id: rs.id, def: toDefinition(rs) };
  }

  async byId(id: string): Promise<{ id: string; def: RuleSetDefinition; row: RuleSetRow }> {
    const rs = await this.prisma.ruleSet.findUnique({ where: { id }, include: { rules: true } });
    if (!rs) throw notFound('Kural seti');
    return { id: rs.id, def: toDefinition(rs), row: rs };
  }

  list() {
    return this.prisma.ruleSet.findMany({
      orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
      include: { rules: { orderBy: { position: 'asc' } }, _count: { select: { applications: true } } },
    });
  }

  /** Etkin seti kopyalayıp parametre değişiklikleriyle yeni taslak sürüm üretir. */
  async create(input: z.infer<typeof RuleSetCreateSchema>, user: AuthUser) {
    const base = await this.active(input.type);
    const codes = new Set(base.def.rules.map((r) => r.code));
    for (const code of Object.keys(input.paramOverrides)) {
      if (!codes.has(code)) throw badRequest(`Kural bulunamadı: ${code}`);
    }
    const created = await this.prisma.ruleSet.create({
      data: {
        version: input.version,
        type: input.type,
        effectiveFrom: input.effectiveFrom,
        status: 'DRAFT',
        note: input.note,
        createdBy: user.username,
        rules: {
          create: base.def.rules.map((r, i) => ({
            code: r.code,
            kind: r.kind,
            article: r.article,
            title: r.title,
            phase: r.phase,
            params: { ...r.params, ...(input.paramOverrides[r.code] ?? {}) } as object,
            position: i,
          })),
        },
      },
      include: { rules: true },
    });
    await this.audit.log({ actor: user.username, action: 'RULESET_CREATE', entity: 'RuleSet', entityId: created.id, after: input });
    return created;
  }

  async activate(id: string, user: AuthUser) {
    const { row } = await this.byId(id);
    if (row.status !== 'DRAFT') throw conflict('Yalnızca taslak sürüm etkinleştirilebilir.');
    await this.prisma.$transaction(async (tx) => {
      await tx.ruleSet.updateMany({ where: { type: row.type, status: 'ACTIVE' }, data: { status: 'RETIRED' } });
      await tx.ruleSet.update({ where: { id }, data: { status: 'ACTIVE' } });
      await this.audit.log({ actor: user.username, action: 'RULESET_ACTIVATE', entity: 'RuleSet', entityId: id }, tx);
    });
    return this.byId(id).then((r) => r.row);
  }

  /** Taslak sürümü değerlendirme bekleyen başvuruların saklı bağlamları üzerinde çalıştırır; sonucu değişenleri listeler. */
  async dryRun(id: string) {
    const { def, row } = await this.byId(id);
    const apps = await this.prisma.application.findMany({
      where: { offering: { type: row.type }, status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'PROPOSED'] } },
      include: { offering: true },
    });
    const rows = apps.map((a) => {
      const snap = a.snapshot as unknown as { ctx: EvaluationContext; fullName: string };
      const ctx = snap.ctx;
      const before = (a.eligibility as unknown as { verdict: Verdict }).verdict;
      const after = evaluate(def, 'APPLICATION', ctx);
      return {
        applicationId: a.id,
        studentNo: a.studentNo,
        fullName: snap.fullName,
        before,
        after: after.verdict,
        changed: before !== after.verdict,
        failed: after.results.filter((r) => r.status === 'FAIL').map((r) => `${r.code}: ${r.message}`),
      };
    });
    return { total: rows.length, changed: rows.filter((r) => r.changed).length, rows };
  }
}
