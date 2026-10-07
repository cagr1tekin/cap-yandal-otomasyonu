import { Injectable } from '@nestjs/common';
import type { EvaluationContext } from '@cap/rules';
import { LABELS, type Proposal } from '@cap/contracts';
import ExcelJS from 'exceljs';
import type { AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService, windowState, type OfferingFull } from '../catalog/catalog.service';
import { badRequest, conflict, notFound } from '../common/http';
import { ObisPort } from '../integrations/obis.port';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { rank } from './ranking';

const REVIEW_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'PROPOSED', 'ACCEPTED', 'WAITLISTED', 'REJECTED', 'ENROLLED', 'NOT_ENROLLED'] as const;

interface Snapshot {
  fullName: string;
  ctx: EvaluationContext;
}

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly obis: ObisPort,
  ) {}

  private async offeringFor(user: AuthUser, id: string, roles: ('KOORDINATOR' | 'BOLUM_BASKANI' | 'BIRIM' | 'OIDB')[]) {
    const o = await this.catalog.getOffering(id);
    this.access.assertOffering(user, o, roles);
    return o;
  }

  private async windowClosed(o: OfferingFull) {
    const w = windowState(await this.catalog.window(o.program.unitId, o.termId, o.type));
    return w.phase === 'KAPANDI';
  }

  /** US-11: başvurular, sıralama ve öneri. Kilitlenmemişse sıralama her istekte yeniden hesaplanır (gerekçeli değişiklikler korunur). */
  async applications(user: AuthUser, offeringId: string) {
    const o = await this.offeringFor(user, offeringId, ['KOORDINATOR', 'BOLUM_BASKANI', 'BIRIM', 'OIDB']);
    const closed = await this.windowClosed(o);

    if (closed && !o.rankingLockedAt) {
      await this.prisma.application.updateMany({ where: { offeringId, status: 'SUBMITTED' }, data: { status: 'UNDER_REVIEW' } });
    }

    let apps = await this.prisma.application.findMany({
      where: { offeringId, status: { in: [...REVIEW_STATUSES] } },
      include: { ranking: true },
    });

    if (!o.rankingLockedAt && apps.length) {
      const ranked = rank(
        apps.map((a) => {
          const s = (a.obisSnapshot as unknown as Snapshot).ctx.student!;
          return { id: a.id, gano: s.gano, classRankPercentile: s.classRankPercentile, submittedAt: a.submittedAt };
        }),
        o.quota,
        o.quota,
      );
      await this.prisma.$transaction(
        ranked.map((r) => {
          const prev = apps.find((a) => a.id === r.id)!.ranking;
          return this.prisma.ranking.upsert({
            where: { applicationId: r.id },
            create: { applicationId: r.id, score: r.score, rank: r.rank, proposal: r.proposal },
            // Gerekçeli değişiklik varsa öneri korunur, sıra güncellenir.
            update: { score: r.score, rank: r.rank, ...(prev?.overriddenBy ? {} : { proposal: r.proposal }) },
          });
        }),
      );
      apps = await this.prisma.application.findMany({
        where: { offeringId, status: { in: [...REVIEW_STATUSES] } },
        include: { ranking: true },
      });
    }

    const decision = await this.prisma.boardDecision.findFirst({ where: { offeringId }, orderBy: { recordedAt: 'desc' } });
    const rows = apps
      .map((a) => {
        const snap = a.obisSnapshot as unknown as Snapshot;
        const s = snap.ctx.student!;
        return {
          id: a.id,
          studentNo: a.studentNo,
          fullName: snap.fullName,
          mainProgramId: s.programId,
          gano: s.gano,
          classRankPercentile: s.classRankPercentile,
          semesterNo: s.semesterNo,
          path: a.path,
          osymVerified: a.osymVerified,
          status: a.status,
          submittedAt: a.submittedAt,
          ranking: a.ranking,
        };
      })
      .sort((x, y) => (x.ranking?.rank ?? 9999) - (y.ranking?.rank ?? 9999));

    const programs = await this.prisma.program.findMany({ where: { id: { in: rows.map((r) => r.mainProgramId) } } });
    return {
      offering: o,
      windowClosed: closed,
      decision,
      strategy: 'GNO azalan; eşitlikte sınıf başarı yüzdeliği, sonra başvuru zamanı',
      rows: rows.map((r) => ({ ...r, mainProgramName: programs.find((p) => p.id === r.mainProgramId)?.name ?? r.mainProgramId })),
    };
  }

  async override(user: AuthUser, applicationId: string, proposal: Proposal, reason: string) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId }, include: { ranking: true } });
    if (!app?.ranking) throw notFound('Sıralama kaydı');
    const o = await this.offeringFor(user, app.offeringId, ['KOORDINATOR', 'OIDB']);
    if (o.rankingLockedAt) throw conflict('Öneri kilitlendi; değişiklik yapılamaz.');
    const updated = await this.prisma.ranking.update({
      where: { applicationId },
      data: { proposal, overriddenBy: user.username, overrideReason: reason },
    });
    await this.audit.log({
      actor: user.username,
      action: 'RANKING_OVERRIDE',
      entity: 'Application',
      entityId: applicationId,
      before: { proposal: app.ranking.proposal },
      after: { proposal },
      reason,
    });
    return updated;
  }

  /** Bölüm önerisini kilitler: başvurular kurul kararı bekler duruma geçer. */
  async lock(user: AuthUser, offeringId: string) {
    const o = await this.offeringFor(user, offeringId, ['KOORDINATOR', 'OIDB']);
    if (o.rankingLockedAt) throw conflict('Öneri zaten kilitli.');
    if (!(await this.windowClosed(o))) throw conflict('Başvuru dönemi kapanmadan öneri kilitlenemez.');
    await this.applications(user, offeringId); // sıralamayı güncelle
    const asil = await this.prisma.ranking.count({ where: { proposal: 'ASIL', application: { offeringId, status: 'UNDER_REVIEW' } } });
    if (asil > o.quota) throw conflict(`Asil önerisi (${asil}) kontenjanı (${o.quota}) aşıyor.`);
    await this.prisma.$transaction(async (tx) => {
      await tx.offering.update({ where: { id: offeringId }, data: { rankingLockedAt: new Date() } });
      await tx.application.updateMany({ where: { offeringId, status: 'UNDER_REVIEW' }, data: { status: 'PROPOSED' } });
      await this.audit.log({ actor: user.username, action: 'RANKING_LOCK', entity: 'Offering', entityId: offeringId, after: { asil } }, tx);
    });
    const unitUsers = await this.unitStaff(o.program.unitId);
    await this.notifications.notifyMany(
      unitUsers,
      'Bölüm önerisi hazır',
      `${o.program.name} ${LABELS.track[o.type].toLowerCase()} önerisi kilitlendi; yönetim kurulu kararı girilebilir.`,
      `/birim/kararlar/${offeringId}`,
    );
    return { ok: true };
  }

  /** US-21: yönetim kurulu kararı. Öneriler karara dönüşür. */
  async decide(user: AuthUser, offeringId: string, decisionDate: Date, decisionNo: string) {
    const o = await this.offeringFor(user, offeringId, ['BIRIM', 'OIDB']);
    if (!o.rankingLockedAt) throw conflict('Bölüm önerisi kilitlenmeden karar girilemez.');
    const existing = await this.prisma.boardDecision.findFirst({ where: { offeringId } });
    if (existing) throw conflict('Bu teklif için karar zaten girildi.');
    const apps = await this.prisma.application.findMany({ where: { offeringId, status: 'PROPOSED' }, include: { ranking: true } });
    const asil = apps.filter((a) => a.ranking?.proposal === 'ASIL').length;
    if (asil > o.quota) throw conflict('Kabul sayısı kontenjanı aşıyor.');

    const status = { ASIL: 'ACCEPTED', YEDEK: 'WAITLISTED', RET: 'REJECTED' } as const;
    const decision = await this.prisma.$transaction(async (tx) => {
      for (const a of apps) {
        await tx.application.update({ where: { id: a.id }, data: { status: status[a.ranking?.proposal ?? 'RET'] } });
      }
      const d = await tx.boardDecision.create({ data: { offeringId, decisionDate, decisionNo, recordedBy: user.username } });
      await this.audit.log({ actor: user.username, action: 'BOARD_DECISION', entity: 'Offering', entityId: offeringId, after: { decisionNo, decisionDate, asil } }, tx);
      return d;
    });
    return decision;
  }

  async publish(user: AuthUser, offeringId: string) {
    const o = await this.offeringFor(user, offeringId, ['BIRIM', 'OIDB']);
    const decision = await this.prisma.boardDecision.findFirst({ where: { offeringId }, orderBy: { recordedAt: 'desc' } });
    if (!decision) throw conflict('Karar kaydedilmeden sonuç yayımlanamaz.');
    if (decision.publishedAt) throw conflict('Sonuçlar zaten yayımlandı.');
    await this.prisma.boardDecision.update({ where: { id: decision.id }, data: { publishedAt: new Date() } });
    await this.audit.log({ actor: user.username, action: 'RESULTS_PUBLISH', entity: 'Offering', entityId: offeringId });

    const apps = await this.prisma.application.findMany({ where: { offeringId, status: { in: ['ACCEPTED', 'WAITLISTED', 'REJECTED'] } }, include: { ranking: true } });
    const track = LABELS.track[o.type].toLowerCase();
    for (const a of apps) {
      const text =
        a.status === 'ACCEPTED'
          ? `${o.program.name} ${track} programına asil olarak kabul edildiniz. Kesin kaydınızı OBİS'te yaptırmanız gerekiyor.`
          : a.status === 'WAITLISTED'
            ? `${o.program.name} ${track} programında ${a.ranking?.rank ?? '-'}. sıradan yedeksiniz. Kontenjan açılırsa bildirim alacaksınız.`
            : `${o.program.name} ${track} başvurunuz kabul edilmedi.`;
      await this.notifications.notify(a.studentNo, 'Başvuru sonucunuz ilan edildi', text, '/ogrenci/basvurularim');
    }
    return { ok: true, notified: apps.length };
  }

  /** OBİS'te kesin kaydını yaptıran asil öğrencilerin kaydını oluşturur. */
  async syncRegistrations(user: AuthUser, offeringId: string) {
    const o = await this.offeringFor(user, offeringId, ['BIRIM', 'OIDB']);
    const accepted = await this.prisma.application.findMany({ where: { offeringId, status: 'ACCEPTED' } });
    const result = { enrolled: [] as string[], waiting: [] as string[], conflicts: [] as string[] };
    for (const a of accepted) {
      if (!(await this.obis.isRegistered(a.studentNo, o.programId))) {
        result.waiting.push(a.studentNo);
        continue;
      }
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.application.update({ where: { id: a.id }, data: { status: 'ENROLLED' } });
          const e = await tx.enrollment.create({
            data: { studentNo: a.studentNo, offeringId, applicationId: a.id, type: o.type, programId: o.programId, startTermId: o.termId },
          });
          await this.audit.log({ actor: user.username, action: 'ENROLLMENT_CREATE', entity: 'Enrollment', entityId: e.id, after: { applicationId: a.id } }, tx);
        });
        result.enrolled.push(a.studentNo);
        await this.notifications.notify(a.studentNo, 'Kaydınız tamamlandı', `${o.program.name} ${LABELS.track[o.type].toLowerCase()} kaydınız etkinleşti.`, '/ogrenci/programlarim');
      } catch {
        // Kısmi benzersiz indeks: öğrencinin aynı türde etkin kaydı var.
        result.conflicts.push(a.studentNo);
      }
    }
    return result;
  }

  /** FR-16: kayıt süresi biter; kaydolmayan asiller düşer, sıradaki yedekler çağrılır. */
  async closeRegistration(user: AuthUser, offeringId: string) {
    const o = await this.offeringFor(user, offeringId, ['BIRIM', 'OIDB']);
    if (o.registrationClosedAt) throw conflict('Kayıt dönemi zaten kapatıldı.');
    await this.syncRegistrations(user, offeringId);
    const dropped = await this.prisma.application.findMany({ where: { offeringId, status: 'ACCEPTED' } });
    await this.prisma.application.updateMany({ where: { offeringId, status: 'ACCEPTED' }, data: { status: 'NOT_ENROLLED' } });
    const enrolled = await this.prisma.application.count({ where: { offeringId, status: 'ENROLLED' } });
    const seats = Math.max(0, o.quota - enrolled);
    const waitlist = await this.prisma.application.findMany({
      where: { offeringId, status: 'WAITLISTED' },
      include: { ranking: true },
      orderBy: { ranking: { rank: 'asc' } },
      take: seats,
    });
    await this.prisma.$transaction(async (tx) => {
      for (const w of waitlist) await tx.application.update({ where: { id: w.id }, data: { status: 'ACCEPTED' } });
      await tx.offering.update({ where: { id: offeringId }, data: { registrationClosedAt: new Date() } });
      await this.audit.log(
        { actor: user.username, action: 'REGISTRATION_CLOSE', entity: 'Offering', entityId: offeringId, after: { dropped: dropped.map((d) => d.studentNo), promoted: waitlist.map((w) => w.studentNo) } },
        tx,
      );
    });
    for (const w of waitlist) {
      await this.notifications.notify(
        w.studentNo,
        'Yedekten asil listeye geçtiniz',
        `${o.program.name} ${LABELS.track[o.type].toLowerCase()} programında kontenjan açıldı. Kesin kaydınızı OBİS'te yaptırın.`,
        '/ogrenci/basvurularim',
      );
    }
    return { dropped: dropped.length, promoted: waitlist.map((w) => w.studentNo) };
  }

  /** US-22 / FR-18: kabul listesi. */
  async export(user: AuthUser, offeringId: string, format: 'csv' | 'xlsx') {
    const data = await this.applications(user, offeringId);
    if (!data.decision) throw badRequest('Karar girilmeden liste dışa aktarılamaz.');
    const header = ['Sıra', 'Öğrenci No', 'Ad Soyad', 'Ana Dal', 'GNO', 'Sınıf Yüzdeliği', 'Yol', 'Öneri', 'Durum'];
    const rows = data.rows.map((r) => [
      r.ranking?.rank ?? '',
      r.studentNo,
      r.fullName,
      r.mainProgramName,
      r.gano.toFixed(2).replace('.', ','),
      r.classRankPercentile ?? '',
      r.path === 'RANK' ? 'Başarı sırası' : 'YKS taban puan',
      r.ranking ? LABELS.proposal[r.ranking.proposal] : '',
      LABELS.application[r.status],
    ]);
    const name = `${data.offering.program.name} ${LABELS.track[data.offering.type]} ${data.offering.term.year}`;
    if (format === 'csv') {
      const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = '﻿' + [header, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
      return { name: `${name}.csv`, type: 'text/csv; charset=utf-8', body: Buffer.from(csv, 'utf-8') };
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Liste');
    ws.addRow([`${name} — Karar ${data.decision.decisionNo} (${data.decision.decisionDate.toLocaleDateString('tr-TR')})`]);
    ws.addRow(header).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((c) => (c.width = 18));
    return { name: `${name}.xlsx`, type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: Buffer.from(await wb.xlsx.writeBuffer()) };
  }

  private async unitStaff(unitId: string) {
    const rows = await this.prisma.roleAssignment.findMany({ where: { role: 'BIRIM', unitId }, include: { user: true } });
    return rows.map((r) => r.user.username);
  }

  async decisionsOverview(user: AuthUser, termId?: string) {
    const term = termId ? { id: termId } : await this.catalog.currentTerm();
    const offerings = await this.catalog.listForStaff(user, { termId: term?.id });
    const ids = offerings.map((o) => o.id);
    const [decisions, counts] = await Promise.all([
      this.prisma.boardDecision.findMany({ where: { offeringId: { in: ids } } }),
      this.prisma.application.groupBy({ by: ['offeringId', 'status'], where: { offeringId: { in: ids } }, _count: true }),
    ]);
    return offerings.map((o) => ({
      ...o,
      decision: decisions.find((d) => d.offeringId === o.id) ?? null,
      counts: Object.fromEntries(counts.filter((c) => c.offeringId === o.id).map((c) => [c.status, c._count])),
    }));
  }
}
