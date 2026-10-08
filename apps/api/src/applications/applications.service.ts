import { Injectable } from '@nestjs/common';
import { evaluate, type EvaluationContext, type EvaluationOutcome, type TrackType } from '@cap/rules';
import { APPLICATION_DOCUMENTS, LABELS, type ApplicationStatus, type DocumentDef, type DocumentKind } from '@cap/contracts';
import type { Document, Program, StudentProfile } from '@prisma/client';
import type { AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService, offeringInclude, windowState, type OfferingFull } from '../catalog/catalog.service';
import { conflict, forbidden, notFound, unprocessable } from '../common/http';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { ContextService } from '../rules/context.service';
import { RulesService } from '../rules/rules.service';

type Path = 'RANK' | 'ENTRY_SCORE';

export interface Snapshot {
  fullName: string;
  mainProgramName: string;
  takenAt: string;
  ctx: EvaluationContext;
  /** Öğrencinin başvuru anındaki beyanı (koordinatörün belgeyle karşılaştırdığı değerler). */
  declared: Pick<StudentProfile, 'gano' | 'semesterNo' | 'completedAllCourses' | 'classRank' | 'classSize' | 'entryYear' | 'entryScore' | 'successRank'>;
}

/**
 * Başvuruda yüklenmesi zorunlu belgeler (Bölüm ÇAP Rehberi 2025, "Başvuru"):
 * - ÇAP: YKS başarı sırası ve puan belgesi her zaman; transkript ve ilk %20 belgesi fakülte dışından gelenlerde.
 * - Yan dal: transkript (Yan Dal Uygulama Esasları m.1).
 * Dilekçeyi sistem üretir.
 */
export function requiredDocuments(type: TrackType, sameFaculty: boolean): DocumentDef[] {
  const keys: DocumentKind[] = type === 'YANDAL' ? ['TRANSKRIPT'] : sameFaculty ? ['YKS_BELGESI'] : ['TRANSKRIPT', 'BASARI_BELGESI', 'YKS_BELGESI'];
  return keys.map((k) => APPLICATION_DOCUMENTS.find((d) => d.key === k)!);
}

function pathOf(outcome: EvaluationOutcome): Path {
  const rank = outcome.results.find((r) => r.kind === 'ANY_OF')?.children?.find((c) => c.kind === 'CLASS_RANK_TOP');
  return !rank || rank.status === 'PASS' ? 'RANK' : 'ENTRY_SCORE';
}

const LOCKED: ApplicationStatus[] = ['PROPOSED', 'ACCEPTED', 'WAITLISTED', 'REJECTED', 'ENROLLED', 'NOT_ENROLLED'];
const REAPPLY: ApplicationStatus[] = ['WITHDRAWN', 'INELIGIBLE'];

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly context: ContextService,
    private readonly rules: RulesService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async profileOf(user: AuthUser) {
    if (!user.studentNo) return null;
    return this.prisma.studentProfile.findUnique({ where: { studentNo: user.studentNo }, include: { program: true, documents: { orderBy: { uploadedAt: 'desc' } } } });
  }

  /** Her belge türünden en son yüklenen. */
  private latestDocs(docs: Document[]) {
    const map = new Map<DocumentKind, Document>();
    for (const d of docs) if (!map.has(d.kind)) map.set(d.kind, d);
    return map;
  }

  private async assess(profile: StudentProfile & { program: Program; documents: Document[] }, o: OfferingFull, verified = false) {
    const [{ id: ruleSetId, def }, ctx, home] = await Promise.all([this.rules.active(o.type), this.context.application(profile, o, verified), this.access.home()]);
    const outcome = evaluate(def, 'APPLICATION', ctx);
    const required = requiredDocuments(o.type, profile.program.faculty === home.faculty);
    const latest = this.latestDocs(profile.documents);
    return { ruleSetId, ctx, outcome, path: pathOf(outcome), required, missing: required.filter((d) => !latest.has(d.key)), latest };
  }

  /** Öğrenci: açık tekliflere uygunluk ön izlemesi (girdiği bilgilerle kurallar anında çalışır). */
  async eligibility(user: AuthUser) {
    const [term, profile] = await Promise.all([this.catalog.currentTerm(), this.profileOf(user)]);
    if (!term) return { term: null, hasProfile: !!profile, items: [] };
    const offerings = await this.prisma.offering.findMany({ where: { termId: term.id, status: 'PUBLISHED' }, include: offeringInclude, orderBy: { type: 'asc' } });
    if (!profile) {
      return { term, hasProfile: false, items: offerings.map((o) => ({ offering: this.shapeOffering(o), window: windowState(o), verdict: null, results: [], requiredDocuments: [], missingDocuments: [], application: null })) };
    }
    const apps = await this.prisma.application.findMany({ where: { studentNo: profile.studentNo, offeringId: { in: offerings.map((o) => o.id) } } });
    const items = [];
    for (const o of offerings) {
      const a = await this.assess(profile, o);
      const app = apps.find((x) => x.offeringId === o.id);
      items.push({
        offering: this.shapeOffering(o),
        window: windowState(o),
        verdict: a.outcome.verdict,
        path: a.path,
        results: a.outcome.results,
        requiredDocuments: a.required,
        missingDocuments: a.missing,
        application: app ? { id: app.id, status: app.status } : null,
      });
    }
    return { term, hasProfile: true, items };
  }

  private shapeOffering(o: OfferingFull) {
    return {
      id: o.id,
      type: o.type,
      quota: o.quota,
      term: o.term,
      sourcePrograms: o.sourcePrograms.map((s) => s.program.name),
      announceAt: o.announceAt,
      registrationDeadline: o.registrationDeadline,
    };
  }

  /** Öğrenci başvurusu: beyan ettiği bilgilerle kurallar çalışır, yüklediği belgeler başvuruya eklenir. */
  async create(user: AuthUser, offeringId: string, ip?: string) {
    const profile = await this.profileOf(user);
    if (!profile) throw conflict('Başvurmadan önce "Bilgilerim" sayfasında bilgilerinizi kaydedin.');
    const offering = await this.catalog.getOffering(offeringId);
    if (!windowState(offering).open) throw conflict('Bu teklif şu anda başvuruya açık değil.', { window: windowState(offering) });

    const existing = await this.prisma.application.findUnique({ where: { studentNo_offeringId: { studentNo: profile.studentNo, offeringId } } });
    if (existing && !REAPPLY.includes(existing.status)) throw conflict('Bu programa başvurunuz zaten kayıtlı.');

    const a = await this.assess(profile, offering);
    if (a.missing.length) {
      throw unprocessable('Zorunlu belgeler yüklenmemiş; başvuru alınamaz.', { errors: a.missing.map((d) => ({ path: d.key, message: `${d.label} (${d.source})` })) });
    }
    const status: ApplicationStatus = a.outcome.verdict === 'INELIGIBLE' ? 'INELIGIBLE' : 'SUBMITTED';
    const snapshot: Snapshot = {
      fullName: profile.fullName,
      mainProgramName: profile.program.name,
      takenAt: new Date().toISOString(),
      ctx: a.ctx,
      declared: {
        gano: profile.gano,
        semesterNo: profile.semesterNo,
        completedAllCourses: profile.completedAllCourses,
        classRank: profile.classRank,
        classSize: profile.classSize,
        entryYear: profile.entryYear,
        entryScore: profile.entryScore,
        successRank: profile.successRank,
      },
    };
    const data = {
      ruleSetId: a.ruleSetId,
      path: a.path,
      snapshot: snapshot as unknown as object,
      eligibility: a.outcome as unknown as object,
      status,
      verification: 'PENDING' as const,
      verifiedBy: null,
      verifiedAt: null,
      verificationNote: null,
      withdrawReason: null,
      submittedAt: new Date(),
      withdrawnAt: null,
    };
    const docIds = a.required.map((d) => a.latest.get(d.key)!.id);
    const app = await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.application.update({ where: { id: existing.id }, data })
        : await tx.application.create({ data: { ...data, studentNo: profile.studentNo, offeringId } });
      await tx.applicationDocument.deleteMany({ where: { applicationId: saved.id } });
      await tx.applicationDocument.createMany({ data: docIds.map((documentId) => ({ applicationId: saved.id, documentId })) });
      await this.audit.log(
        { actor: user.username, action: 'APPLICATION_SUBMIT', entity: 'Application', entityId: saved.id, after: { studentNo: profile.studentNo, offeringId, path: a.path, status, declared: snapshot.declared }, ip },
        tx,
      );
      return saved;
    });

    const track = LABELS.track[offering.type];
    if (status === 'INELIGIBLE') {
      const reasons = a.outcome.results.filter((r) => r.status === 'FAIL').map((r) => `- ${r.title}: ${r.message} (${r.article})`);
      await this.notifications.notify(user.username, 'Başvurunuz koşulları sağlamıyor', `${track} başvurunuz kayda alındı ancak şu koşullar sağlanmadığı için değerlendirmeye alınmayacak:\n${reasons.join('\n')}`, `/ogrenci/basvuru/${app.id}`);
    } else {
      await this.notifications.notify(
        user.username,
        'Başvurunuz alındı',
        `Bilgisayar Mühendisliği ${track.toLowerCase()} başvurunuz alındı. Beyan ettiğiniz bilgiler komisyonca belgelerinizle karşılaştırılacak. Sonuç ${offering.announceAt ? offering.announceAt.toLocaleDateString('tr-TR') : 'ilan tarihinde'} duyurulacak.`,
        `/ogrenci/basvuru/${app.id}`,
      );
      await this.notifications.notifyCoordinators('Yeni başvuru', `${profile.fullName} (${profile.studentNo}) ${track.toLowerCase()} başvurusu yaptı; beyanı doğrulanmayı bekliyor.`, `/koordinator/basvurular/${app.id}`);
    }
    return { application: app, verdict: a.outcome.verdict, results: a.outcome.results };
  }

  /** Öğrenci kendi başvurusunu, komisyon herhangi bir başvuruyu değerlendirme kilitlenene kadar geri çekebilir. */
  async withdraw(user: AuthUser, id: string, reason: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw notFound('Başvuru');
    if (app.studentNo !== user.studentNo && !this.access.isCoordinator(user)) throw forbidden();
    if (LOCKED.includes(app.status) || app.status === 'WITHDRAWN') throw conflict('Değerlendirme kilitlendikten sonra başvuru geri çekilemez.');
    const updated = await this.prisma.application.update({ where: { id }, data: { status: 'WITHDRAWN', withdrawnAt: new Date(), withdrawReason: reason } });
    await this.audit.log({ actor: user.username, action: 'APPLICATION_WITHDRAW', entity: 'Application', entityId: id, before: { status: app.status }, reason });
    return updated;
  }

  async mine(user: AuthUser) {
    if (!user.studentNo) return [];
    const apps = await this.prisma.application.findMany({
      where: { studentNo: user.studentNo },
      include: { offering: { include: offeringInclude }, ranking: true, enrollment: { select: { id: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    const decisions = await this.prisma.boardDecision.findMany({ where: { offeringId: { in: apps.map((a) => a.offeringId) }, publishedAt: { not: null } } });
    return apps.map((a) => {
      const published = decisions.some((d) => d.offeringId === a.offeringId);
      // Sonuç ilan edilene kadar öğrenci kurul sonucunu görmez.
      const hidden = !published && (['PROPOSED', 'ACCEPTED', 'WAITLISTED', 'REJECTED'] as ApplicationStatus[]).includes(a.status);
      return {
        id: a.id,
        status: hidden ? ('UNDER_REVIEW' as ApplicationStatus) : a.status,
        verification: a.verification,
        path: a.path,
        submittedAt: a.submittedAt,
        rank: published ? (a.ranking?.rank ?? null) : null,
        enrollmentId: a.enrollment?.id ?? null,
        offering: this.shapeOffering(a.offering),
        registrationOpen: a.status === 'ACCEPTED' && published && !a.offering.registrationClosedAt,
      };
    });
  }

  async list(f: { termId?: string; offeringId?: string; status?: string; verification?: string; q?: string }) {
    const term = f.termId ?? (f.offeringId ? undefined : (await this.catalog.currentTerm())?.id);
    const apps = await this.prisma.application.findMany({
      where: {
        offering: { ...(term ? { termId: term } : {}), ...(f.offeringId ? { id: f.offeringId } : {}) },
        ...(f.status ? { status: f.status as ApplicationStatus } : {}),
        ...(f.verification ? { verification: f.verification as 'PENDING' | 'VERIFIED' | 'MISMATCH' } : {}),
        ...(f.q ? { OR: [{ studentNo: { startsWith: f.q } }, { student: { fullName: { contains: f.q, mode: 'insensitive' } } }] } : {}),
      },
      include: { offering: { include: { term: true } }, student: { include: { program: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 500,
    });
    return apps.map((a) => {
      const snap = a.snapshot as unknown as Snapshot;
      return {
        id: a.id,
        studentNo: a.studentNo,
        fullName: snap.fullName,
        mainProgramName: snap.mainProgramName,
        gano: snap.declared.gano,
        status: a.status,
        verification: a.verification,
        path: a.path,
        submittedAt: a.submittedAt,
        offering: { id: a.offeringId, type: a.offering.type, term: a.offering.term },
      };
    });
  }

  async get(user: AuthUser, id: string) {
    const a = await this.prisma.application.findUnique({
      where: { id },
      include: {
        offering: { include: offeringInclude },
        student: { include: { program: true } },
        documents: { include: { document: true } },
        ranking: true,
        ruleSet: { select: { version: true } },
        enrollment: { select: { id: true } },
      },
    });
    if (!a) throw notFound('Başvuru');
    if (!(await this.access.canSeeStudent(user, a.student))) throw forbidden('Bu başvuruya erişim yetkiniz yok.');
    const [home, staff, decision] = await Promise.all([
      this.access.home(),
      this.access.isDepartmentStaff(user),
      this.prisma.boardDecision.findFirst({ where: { offeringId: a.offeringId, publishedAt: { not: null } } }),
    ]);
    const own = user.studentNo === a.studentNo;
    const hidden = own && !decision && (['PROPOSED', 'ACCEPTED', 'WAITLISTED', 'REJECTED'] as ApplicationStatus[]).includes(a.status);
    return {
      ...a,
      status: hidden ? ('UNDER_REVIEW' as ApplicationStatus) : a.status,
      ranking: hidden ? null : a.ranking,
      documents: a.documents.map((d) => ({ id: d.document.id, kind: d.document.kind, fileName: d.document.fileName, size: d.document.size, uploadedAt: d.document.uploadedAt })),
      requiredDocuments: requiredDocuments(a.offering.type, a.student.program.faculty === home.faculty),
      sameFaculty: a.student.program.faculty === home.faculty,
      window: windowState(a.offering),
      decisionPublished: !!decision,
      audit: staff ? await this.audit.list('Application', id) : [],
      can: {
        verify: this.access.isCoordinator(user) && (a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW') && !a.offering.rankingLockedAt,
        withdraw: (own || this.access.isCoordinator(user)) && !LOCKED.includes(a.status) && a.status !== 'WITHDRAWN',
        accept: own && a.status === 'ACCEPTED' && !!decision && !a.offering.registrationClosedAt,
      },
    };
  }

  /**
   * Koordinatör, öğrencinin beyanını yüklenen belgelerle (fakülte içi öğrencide öğrenci işleri teyidiyle)
   * karşılaştırır. Uyuşmazlıkta başvuru değerlendirmeye alınmaz; öğrenci bilgilerini düzeltip yeniden başvurabilir.
   */
  async verify(user: AuthUser, id: string, status: 'VERIFIED' | 'MISMATCH', note?: string) {
    const app = await this.prisma.application.findUnique({ where: { id }, include: { offering: { include: offeringInclude }, student: { include: { user: true } } } });
    if (!app) throw notFound('Başvuru');
    if (app.status !== 'SUBMITTED' && app.status !== 'UNDER_REVIEW') throw conflict('Yalnızca değerlendirmedeki başvurular doğrulanır.');
    if (app.offering.rankingLockedAt) throw conflict('Sıralama kilitlendi; doğrulama değiştirilemez.');
    if (status === 'MISMATCH' && (!note || note.length < 5)) throw unprocessable('Uyuşmazlık için hangi bilginin belgeyle uyuşmadığını yazın.');

    const snap = app.snapshot as unknown as Snapshot;
    const { def } = await this.rules.byId(app.ruleSetId);
    // Doğrulama, taban puan yolundaki "belge doğrulanmalı" koşulunu kaldırır (KR-ÇAP-03b).
    const ctx: EvaluationContext = { ...snap.ctx, osymVerified: status === 'VERIFIED' };
    const outcome = evaluate(def, 'APPLICATION', ctx);
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.application.update({
        where: { id },
        data: {
          verification: status,
          verifiedBy: user.username,
          verifiedAt: new Date(),
          verificationNote: note ?? null,
          eligibility: outcome as unknown as object,
          snapshot: { ...snap, ctx } as unknown as object,
          ...(status === 'MISMATCH' ? { status: 'INELIGIBLE' as const } : {}),
        },
      });
      await this.audit.log({ actor: user.username, action: `APPLICATION_${status}`, entity: 'Application', entityId: id, before: { verification: app.verification }, after: { verification: status }, reason: note }, tx);
      return u;
    });
    await this.notifications.notify(
      app.student.user.username,
      status === 'VERIFIED' ? 'Beyanınız doğrulandı' : 'Beyanınız belgelerle uyuşmuyor',
      status === 'VERIFIED'
        ? `${LABELS.track[app.offering.type]} başvurunuzdaki bilgiler belgelerinizle doğrulandı; başvurunuz sıralamaya alınacak.`
        : `${LABELS.track[app.offering.type]} başvurunuz değerlendirmeye alınmadı: ${note}. Başvuru dönemi açıksa bilgilerinizi düzeltip yeniden başvurabilirsiniz.`,
      `/ogrenci/basvuru/${id}`,
    );
    return updated;
  }
}
