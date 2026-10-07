import { Injectable } from '@nestjs/common';
import { evaluate, type EvaluationOutcome, type TrackType } from '@cap/rules';
import type { CreateApplicationInput } from '@cap/contracts';
import { AuditService } from '../audit/audit.service';
import { CatalogService, offeringInclude, windowState } from '../catalog/catalog.service';
import { conflict, notFound, unprocessable } from '../common/http';
import { OsymPort } from '../integrations/obis.port';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { ContextService } from '../rules/context.service';
import { RulesService } from '../rules/rules.service';

/** Sonuç ilan edilmeden öğrenciye gösterilmeyen durumlar. */
const HIDDEN_UNTIL_PUBLISHED = new Set(['ACCEPTED', 'WAITLISTED', 'REJECTED']);

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly context: ContextService,
    private readonly rules: RulesService,
    private readonly osym: OsymPort,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** US-01: içinde bulunulan dönemde yayımlanmış tüm tekliflerin uygunluk listesi. */
  async eligibility(studentNo: string, type: TrackType) {
    const term = await this.catalog.currentTerm();
    if (!term) return { term: null, student: null, items: [] };
    const [{ def }, student, offerings, apps] = await Promise.all([
      this.rules.active(type),
      this.context.student(studentNo),
      this.prisma.offering.findMany({
        where: { termId: term.id, type, status: 'PUBLISHED' },
        include: offeringInclude,
        orderBy: [{ program: { unit: { name: 'asc' } } }, { program: { name: 'asc' } }],
      }),
      this.prisma.application.findMany({ where: { studentNo, offering: { termId: term.id, type } } }),
    ]);
    const windows = await this.prisma.applicationWindow.findMany({ where: { termId: term.id, type } });
    const mainProgram = await this.prisma.program.findUnique({ where: { id: student.programId }, include: { unit: true } });

    const items = [];
    for (const o of offerings) {
      const { ctx } = await this.context.application(studentNo, o, { student });
      const outcome = evaluate(def, 'APPLICATION', ctx);
      const app = apps.find((a) => a.offeringId === o.id && a.status !== 'WITHDRAWN');
      items.push({
        offering: {
          id: o.id,
          type: o.type,
          quota: o.quota,
          programId: o.programId,
          programName: o.program.name,
          unitName: o.program.unit.name,
          coordinatorUsername: o.coordinatorUsername,
          sourcePrograms: o.sourcePrograms.map((s) => s.program.name),
          poolEcts: o.poolCourses.reduce((t, c) => t + c.ects, 0),
        },
        window: windowState(windows.find((w) => w.unitId === o.program.unitId)),
        verdict: outcome.verdict,
        results: outcome.results,
        application: app ? { id: app.id, status: app.status } : null,
      });
    }
    return {
      term,
      student: {
        studentNo,
        fullName: student.fullName,
        programName: mainProgram?.name,
        unitName: mainProgram?.unit.name,
        semesterNo: student.semesterNo,
        gano: student.gano,
        classRankPercentile: student.classRankPercentile,
      },
      items,
    };
  }

  /** US-02: başvuru. OBİS'ten taze veri çekilir ve anlık görüntü saklanır. */
  async create(studentNo: string, input: CreateApplicationInput, ip?: string) {
    const offering = await this.catalog.getOffering(input.offeringId);
    if (offering.status !== 'PUBLISHED') throw conflict('Bu program başvuruya açık değil.');
    const window = windowState(await this.catalog.window(offering.program.unitId, offering.termId, offering.type));
    if (!window.open) throw conflict('Başvuru takvimi açık değil.', { window });

    const existing = await this.prisma.application.findUnique({
      where: { studentNo_offeringId: { studentNo, offeringId: offering.id } },
    });
    if (existing && existing.status !== 'WITHDRAWN') throw conflict('Bu programa zaten başvurdunuz.');

    let osymVerified = false;
    if (input.osymDocNo && input.osymVerificationCode) {
      const v = await this.osym.verifyResultDocument(input.osymDocNo, input.osymVerificationCode);
      if (!v.valid || v.studentNo !== studentNo) {
        throw unprocessable('ÖSYM sonuç belgesi doğrulanamadı. Belge numarasını ve doğrulama kodunu kontrol edin.');
      }
      osymVerified = true;
    }

    const { id: ruleSetId, def } = await this.rules.active(offering.type);
    const { ctx, fullName } = await this.context.application(studentNo, offering, { fresh: true, osymVerified });
    const outcome: EvaluationOutcome = evaluate(def, 'APPLICATION', ctx);

    if (outcome.verdict === 'INELIGIBLE') {
      throw unprocessable('Başvuru koşulları sağlanmıyor.', { results: outcome.results.filter((r) => r.status === 'FAIL') });
    }
    if (outcome.verdict === 'CONDITIONAL') {
      throw unprocessable('Taban puan yolu için ÖSYM sonuç belgesi doğrulanmalıdır.', { needsOsym: true });
    }

    const rankChild = outcome.results.find((r) => r.kind === 'ANY_OF')?.children?.find((c) => c.kind === 'CLASS_RANK_TOP');
    const path = !rankChild || rankChild.status === 'PASS' ? 'RANK' : 'ENTRY_SCORE';
    const data = {
      ruleSetId,
      path: path as 'RANK' | 'ENTRY_SCORE',
      osymDocNo: input.osymDocNo ?? null,
      osymVerified,
      obisSnapshot: { fullName, takenAt: new Date().toISOString(), ctx } as object,
      eligibility: outcome as unknown as object,
      status: 'SUBMITTED' as const,
      submittedAt: new Date(),
      withdrawnAt: null,
    };

    const app = await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.application.update({ where: { id: existing.id }, data })
        : await tx.application.create({ data: { ...data, studentNo, offeringId: offering.id } });
      await this.audit.log(
        { actor: studentNo, action: 'APPLICATION_SUBMIT', entity: 'Application', entityId: saved.id, after: { offeringId: offering.id, path, verdict: outcome.verdict }, ip },
        tx,
      );
      return saved;
    });

    await this.notifications.notify(
      studentNo,
      'Başvurunuz alındı',
      `${offering.program.name} ${offering.type === 'CAP' ? 'çift ana dal' : 'yan dal'} başvurunuz alındı. Sonuç ${window.announceAt ? new Date(window.announceAt).toLocaleDateString('tr-TR') : 'ilan tarihinde'} duyurulacak.`,
      '/ogrenci/basvurularim',
    );
    return app;
  }

  async withdraw(studentNo: string, id: string) {
    const app = await this.prisma.application.findFirst({ where: { id, studentNo }, include: { offering: { include: offeringInclude } } });
    if (!app) throw notFound('Başvuru');
    if (app.status !== 'SUBMITTED') throw conflict('Yalnızca değerlendirmeye alınmamış başvurular geri çekilebilir.');
    const w = windowState(await this.catalog.window(app.offering.program.unitId, app.offering.termId, app.offering.type));
    if (!w.open) throw conflict('Başvuru dönemi kapandığı için geri çekilemez.');
    const updated = await this.prisma.application.update({ where: { id }, data: { status: 'WITHDRAWN', withdrawnAt: new Date() } });
    await this.audit.log({ actor: studentNo, action: 'APPLICATION_WITHDRAW', entity: 'Application', entityId: id });
    return updated;
  }

  /** US-03: öğrencinin başvuruları. Sonuç ilan edilmeden kurul kararı gösterilmez. */
  async mine(studentNo: string) {
    const apps = await this.prisma.application.findMany({
      where: { studentNo },
      include: {
        offering: { include: { ...offeringInclude, decisions: { orderBy: { recordedAt: 'desc' }, take: 1 } } },
        ranking: true,
      },
      orderBy: { submittedAt: 'desc' },
    });
    return apps.map((a) => {
      const decision = a.offering.decisions[0];
      const published = !!decision?.publishedAt;
      const status = HIDDEN_UNTIL_PUBLISHED.has(a.status) && !published ? 'PROPOSED' : a.status;
      return {
        id: a.id,
        status,
        path: a.path,
        submittedAt: a.submittedAt,
        withdrawnAt: a.withdrawnAt,
        offering: {
          id: a.offeringId,
          type: a.offering.type,
          programName: a.offering.program.name,
          unitName: a.offering.program.unit.name,
          term: `${a.offering.term.year} ${a.offering.term.season === 'GUZ' ? 'Güz' : 'Bahar'}`,
        },
        result: published
          ? {
              decisionNo: decision.decisionNo,
              decisionDate: decision.decisionDate,
              publishedAt: decision.publishedAt,
              rank: a.ranking?.rank ?? null,
              proposal: a.ranking?.proposal ?? null,
            }
          : null,
        eligibility: a.eligibility,
      };
    });
  }
}
