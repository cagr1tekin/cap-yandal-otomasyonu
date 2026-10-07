import { Injectable } from '@nestjs/common';
import { evaluate, type EvaluationOutcome, type TrackType } from '@cap/rules';
import { APPLICATION_DOCUMENTS, LABELS, type ApplicationStatus, type DocumentDef, type IntakeApplicationInput } from '@cap/contracts';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService, offeringInclude, windowState, type OfferingFull } from '../catalog/catalog.service';
import { conflict, notFound, unprocessable } from '../common/http';
import { ObisPort, OsymPort } from '../integrations/obis.port';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { ContextService } from '../rules/context.service';
import { RulesService } from '../rules/rules.service';

type Path = 'RANK' | 'ENTRY_SCORE';

/**
 * Başvuru yoluna ve programa göre zorunlu belgeler (KARARLAR K-1, contracts APPLICATION_DOCUMENTS kaynakları).
 * Yan dal: "dilekçe ve transkript" (Yan Dal Uygulama Esasları m.1).
 */
export function requiredDocuments(o: Pick<OfferingFull, 'type' | 'program'>, path: Path): DocumentDef[] {
  const keys = ['DILEKCE', 'TRANSKRIPT'];
  if (o.type === 'CAP') {
    keys.push('OGRENCI_BELGESI');
    keys.push(...(path === 'RANK' ? ['BASARI_BELGESI'] : ['YKS_SONUC', 'YKS_YERLESTIRME']));
    if (o.program.requiresSuccessRank) keys.push('YOK_SIRALAMA');
  }
  return keys.map((k) => APPLICATION_DOCUMENTS.find((d) => d.key === k)!);
}

function pathOf(outcome: EvaluationOutcome): Path {
  const rank = outcome.results.find((r) => r.kind === 'ANY_OF')?.children?.find((c) => c.kind === 'CLASS_RANK_TOP');
  return !rank || rank.status === 'PASS' ? 'RANK' : 'ENTRY_SCORE';
}

const LOCKED: ApplicationStatus[] = ['PROPOSED', 'ACCEPTED', 'WAITLISTED', 'REJECTED', 'ENROLLED', 'NOT_ENROLLED'];

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly context: ContextService,
    private readonly rules: RulesService,
    private readonly obis: ObisPort,
    private readonly osym: OsymPort,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private unitFilter(user: AuthUser): Prisma.OfferingWhereInput {
    return this.access.isOidb(user) ? {} : { program: { unitId: { in: this.access.unitIds(user) } } };
  }

  /** Başvuru girişi 1. adım: öğrenci numarasıyla OBİS bilgisi ve birimin açık programlarına uygunluk. */
  async candidates(user: AuthUser, studentNo: string, type: TrackType) {
    const term = await this.catalog.currentTerm();
    if (!term) return { term: null, student: null, items: [] };
    const [{ def }, student, info] = await Promise.all([
      this.rules.active(type),
      this.context.student(studentNo, true),
      this.obis.getStudent(studentNo),
    ]);
    const [offerings, windows, apps, mainProgram] = await Promise.all([
      this.prisma.offering.findMany({
        where: { termId: term.id, type, status: 'PUBLISHED', ...this.unitFilter(user) },
        include: offeringInclude,
        orderBy: [{ program: { unit: { name: 'asc' } } }, { program: { name: 'asc' } }],
      }),
      this.prisma.applicationWindow.findMany({ where: { termId: term.id, type } }),
      this.prisma.application.findMany({ where: { studentNo, offering: { termId: term.id } }, include: { offering: { include: { program: true } } } }),
      this.prisma.program.findUnique({ where: { id: student.programId }, include: { unit: true } }),
    ]);

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
          programName: o.program.name,
          unitName: o.program.unit.name,
          sourcePrograms: o.sourcePrograms.map((s) => s.program.name),
        },
        window: windowState(windows.find((w) => w.unitId === o.program.unitId)),
        verdict: outcome.verdict,
        path: pathOf(outcome),
        requiredDocuments: requiredDocuments(o, pathOf(outcome)),
        results: outcome.results,
        application: app ? { id: app.id, status: app.status } : null,
      });
    }
    return {
      term,
      student: {
        studentNo,
        fullName: info.fullName,
        email: info.email,
        programName: mainProgram?.name,
        unitName: mainProgram?.unit.name,
        semesterNo: student.semesterNo,
        gano: student.gano,
        classRankPercentile: student.classRankPercentile,
        entryScore: student.entryScore,
      },
      otherApplications: apps.map((a) => ({ id: a.id, status: a.status, programName: a.offering.program.name, type: a.offering.type })),
      items,
    };
  }

  /** Başvuru girişi 2. adım: şahsen verilen dilekçenin evrak kaydıyla panele işlenmesi. */
  async create(user: AuthUser, input: IntakeApplicationInput, ip?: string) {
    const offering = await this.catalog.getOffering(input.offeringId);
    this.access.assertOffering(user, offering, ['BIRIM', 'OIDB']);
    if (offering.status !== 'PUBLISHED') throw conflict('Bu program başvuruya açık değil.');
    const w = await this.catalog.window(offering.program.unitId, offering.termId, offering.type);
    if (!w || input.documentDate < startOfDay(w.opensAt) || input.documentDate > w.closesAt) {
      throw conflict('Dilekçe tarihi başvuru takviminin dışında.', { window: windowState(w) });
    }

    const existing = await this.prisma.application.findUnique({
      where: { studentNo_offeringId: { studentNo: input.studentNo, offeringId: offering.id } },
    });
    if (existing && existing.status !== 'WITHDRAWN') throw conflict('Bu öğrencinin bu programa başvurusu zaten kayıtlı.');

    let osymVerified = false;
    if (input.osymDocNo && input.osymVerificationCode) {
      const v = await this.osym.verifyResultDocument(input.osymDocNo, input.osymVerificationCode);
      if (!v.valid || v.studentNo !== input.studentNo) {
        throw unprocessable('ÖSYM sonuç belgesi doğrulanamadı. Belge numarasını ve doğrulama kodunu kontrol edin.');
      }
      osymVerified = true;
    }

    const { id: ruleSetId, def } = await this.rules.active(offering.type);
    const { ctx, fullName } = await this.context.application(input.studentNo, offering, { fresh: true, osymVerified });
    const outcome = evaluate(def, 'APPLICATION', ctx);
    const path = pathOf(outcome);

    if (outcome.verdict === 'CONDITIONAL') {
      throw unprocessable('Taban puan yolu için ÖSYM sonuç belgesi numarası ve doğrulama kodu girilmelidir.', { needsOsym: true });
    }
    const status: ApplicationStatus = outcome.verdict === 'INELIGIBLE' ? 'INELIGIBLE' : 'SUBMITTED';
    if (status === 'SUBMITTED') {
      const missing = requiredDocuments(offering, path).filter((d) => !input.documents.includes(d.key));
      if (missing.length) {
        throw unprocessable('Zorunlu belgeler eksik; başvuru işleme alınamaz.', {
          errors: missing.map((d) => ({ path: d.key, message: `${d.label} (${d.source})` })),
        });
      }
    }

    const data = {
      ruleSetId,
      path,
      osymDocNo: input.osymDocNo ?? null,
      osymVerified,
      documentNo: input.documentNo,
      documentDate: input.documentDate,
      documents: input.documents,
      enteredBy: user.username,
      note: input.note ?? null,
      withdrawReason: null,
      obisSnapshot: { fullName, takenAt: new Date().toISOString(), ctx } as object,
      eligibility: outcome as unknown as object,
      status,
      submittedAt: new Date(),
      withdrawnAt: null,
    };
    const app = await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.application.update({ where: { id: existing.id }, data })
        : await tx.application.create({ data: { ...data, studentNo: input.studentNo, offeringId: offering.id } });
      await this.audit.log(
        {
          actor: user.username,
          action: 'APPLICATION_INTAKE',
          entity: 'Application',
          entityId: saved.id,
          after: { studentNo: input.studentNo, offeringId: offering.id, documentNo: input.documentNo, path, status },
          ip,
        },
        tx,
      );
      return saved;
    });

    const info = await this.obis.getStudent(input.studentNo);
    const track = LABELS.track[offering.type].toLowerCase();
    if (status === 'INELIGIBLE') {
      const reasons = outcome.results.filter((r) => r.status === 'FAIL').map((r) => `- ${r.title}: ${r.message} (${r.article})`);
      await this.notifications.emailStudent(
        info.email,
        'Başvurunuz koşulları sağlamıyor',
        `${offering.program.name} ${track} başvurunuz (evrak ${input.documentNo}) kayda alındı ancak aşağıdaki koşullar sağlanmadığı için değerlendirmeye alınmayacaktır:\n${reasons.join('\n')}`,
      );
    } else {
      await this.notifications.emailStudent(
        info.email,
        'Başvurunuz alındı',
        `${offering.program.name} ${track} başvurunuz ${input.documentNo} evrak numarasıyla alınmıştır. Sonuç ${w.announceAt ? w.announceAt.toLocaleDateString('tr-TR') : 'ilan tarihinde'} birim web sayfasında ve e-postayla duyurulacaktır.`,
      );
    }
    return { application: app, verdict: outcome.verdict, results: outcome.results };
  }

  async withdraw(user: AuthUser, id: string, reason: string) {
    const app = await this.prisma.application.findUnique({ where: { id }, include: { offering: { include: offeringInclude } } });
    if (!app) throw notFound('Başvuru');
    this.access.assertOffering(user, app.offering, ['BIRIM', 'OIDB']);
    if (LOCKED.includes(app.status) || app.status === 'WITHDRAWN') {
      throw conflict('Bölüm önerisi kilitlendikten sonra başvuru geri çekilemez.');
    }
    const updated = await this.prisma.application.update({
      where: { id },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date(), withdrawReason: reason },
    });
    await this.audit.log({ actor: user.username, action: 'APPLICATION_WITHDRAW', entity: 'Application', entityId: id, before: { status: app.status }, reason });
    return updated;
  }

  async list(user: AuthUser, f: { termId?: string; offeringId?: string; status?: string; studentNo?: string }) {
    const term = f.termId ?? (await this.catalog.currentTerm())?.id;
    const apps = await this.prisma.application.findMany({
      where: {
        offering: { AND: [this.access.offeringWhere(user), term ? { termId: term } : {}, f.offeringId ? { id: f.offeringId } : {}] },
        ...(f.status ? { status: f.status as ApplicationStatus } : {}),
        ...(f.studentNo ? { studentNo: { startsWith: f.studentNo } } : {}),
      },
      include: { offering: { include: { program: { include: { unit: true } } } } },
      orderBy: { submittedAt: 'desc' },
      take: 500,
    });
    return apps.map((a) => ({
      id: a.id,
      studentNo: a.studentNo,
      fullName: (a.obisSnapshot as { fullName?: string }).fullName ?? a.studentNo,
      status: a.status,
      path: a.path,
      documentNo: a.documentNo,
      documentDate: a.documentDate,
      submittedAt: a.submittedAt,
      enteredBy: a.enteredBy,
      offering: { id: a.offeringId, type: a.offering.type, programName: a.offering.program.name, unitName: a.offering.program.unit.name },
    }));
  }

  async get(user: AuthUser, id: string) {
    const a = await this.prisma.application.findUnique({
      where: { id },
      include: { offering: { include: offeringInclude }, ranking: true, ruleSet: { select: { version: true } }, enrollment: true },
    });
    if (!a) throw notFound('Başvuru');
    this.access.assertOffering(user, a.offering, ['KOORDINATOR', 'BOLUM_BASKANI', 'BIRIM', 'OIDB']);
    const audit = await this.audit.list('Application', id);
    return { ...a, requiredDocuments: requiredDocuments(a.offering, a.path), audit };
  }
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
