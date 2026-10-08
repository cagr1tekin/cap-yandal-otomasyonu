import { Injectable } from '@nestjs/common';
import { LABELS, type Proposal } from '@cap/contracts';
import ExcelJS from 'exceljs';
import type { AuthUser } from '../auth/auth';
import { AuditService } from '../audit/audit.service';
import type { Snapshot } from '../applications/applications.service';
import { CatalogService, windowState } from '../catalog/catalog.service';
import { badRequest, conflict, forbidden, notFound } from '../common/http';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { rank } from './ranking';

const REVIEW_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'PROPOSED', 'ACCEPTED', 'WAITLISTED', 'REJECTED', 'ENROLLED', 'NOT_ENROLLED'] as const;

/** Öğrenci numarası ve ad, ilan listesinde maskelenir (KVKK; fakülte ilanlarındaki uygulama). */
export const maskNo = (no: string) => `${no.slice(0, 3)}***${no.slice(-3)}`;
export const maskName = (name: string) =>
  name
    .split(' ')
    .map((p) => `${p.slice(0, 2)}${'*'.repeat(Math.max(1, p.length - 2))}`)
    .join(' ');

@Injectable()
export class ReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private usernames(studentNos: string[]) {
    return this.prisma.studentProfile
      .findMany({ where: { studentNo: { in: studentNos } }, include: { user: { select: { username: true } } } })
      .then((rows) => new Map(rows.map((r) => [r.studentNo, r.user.username])));
  }

  /** Başvurular, sıralama ve öneri. Kilitlenmemişse sıralama her istekte yeniden hesaplanır (gerekçeli değişiklikler korunur). */
  async applications(offeringId: string) {
    const o = await this.catalog.getOffering(offeringId);
    const closed = windowState(o).phase === 'KAPANDI';

    if (closed && !o.rankingLockedAt) {
      await this.prisma.application.updateMany({ where: { offeringId, status: 'SUBMITTED' }, data: { status: 'UNDER_REVIEW' } });
    }

    let apps = await this.prisma.application.findMany({ where: { offeringId, status: { in: [...REVIEW_STATUSES] } }, include: { ranking: true } });

    if (!o.rankingLockedAt && apps.length) {
      const ranked = rank(
        apps.map((a) => {
          const s = (a.snapshot as unknown as Snapshot).ctx.student!;
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
      apps = await this.prisma.application.findMany({ where: { offeringId, status: { in: [...REVIEW_STATUSES] } }, include: { ranking: true } });
    }

    const decision = await this.prisma.boardDecision.findFirst({ where: { offeringId }, orderBy: { recordedAt: 'desc' } });
    const rows = apps
      .map((a) => {
        const snap = a.snapshot as unknown as Snapshot;
        const s = snap.ctx.student!;
        return {
          id: a.id,
          studentNo: a.studentNo,
          fullName: snap.fullName,
          mainProgramName: snap.mainProgramName,
          gano: s.gano,
          classRankPercentile: s.classRankPercentile,
          semesterNo: s.semesterNo,
          path: a.path,
          verification: a.verification,
          status: a.status,
          submittedAt: a.submittedAt,
          ranking: a.ranking,
        };
      })
      .sort((x, y) => (x.ranking?.rank ?? 9999) - (y.ranking?.rank ?? 9999));

    return {
      offering: o,
      window: windowState(o),
      windowClosed: closed,
      decision,
      unverified: rows.filter((r) => r.verification !== 'VERIFIED' && (r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW')).length,
      strategy: 'GNO azalan; eşitlikte sınıf başarı yüzdeliği, sonra başvuru zamanı',
      rows,
    };
  }

  async override(user: AuthUser, applicationId: string, proposal: Proposal, reason: string) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId }, include: { ranking: true, offering: true } });
    if (!app?.ranking) throw notFound('Sıralama kaydı');
    if (app.offering.rankingLockedAt) throw conflict('Öneri kilitlendi; değişiklik yapılamaz.');
    const updated = await this.prisma.ranking.update({ where: { applicationId }, data: { proposal, overriddenBy: user.username, overrideReason: reason } });
    await this.audit.log({ actor: user.username, action: 'RANKING_OVERRIDE', entity: 'Application', entityId: applicationId, before: { proposal: app.ranking.proposal }, after: { proposal }, reason });
    return updated;
  }

  /** Komisyon önerisini kilitler: başvurular fakülte yönetim kurulu kararını bekler duruma geçer. */
  async lock(user: AuthUser, offeringId: string) {
    const data = await this.applications(offeringId);
    const o = data.offering;
    if (o.rankingLockedAt) throw conflict('Öneri zaten kilitli.');
    if (!data.windowClosed) throw conflict('Başvuru dönemi kapanmadan öneri kilitlenemez.');
    // Öğrencinin kendi girdiği bilgiler belgeyle doğrulanmadan sıralama kesinleşmez (K-12).
    if (data.unverified) throw conflict(`${data.unverified} başvurunun beyanı henüz doğrulanmadı. Önce doğrulayın ya da uyuşmazlık olarak işaretleyin.`);
    const asil = data.rows.filter((r) => r.status === 'UNDER_REVIEW' && r.ranking?.proposal === 'ASIL').length;
    if (asil > o.quota) throw conflict(`Asil önerisi (${asil}) kontenjanı (${o.quota}) aşıyor.`);
    await this.prisma.$transaction(async (tx) => {
      await tx.offering.update({ where: { id: offeringId }, data: { rankingLockedAt: new Date() } });
      await tx.application.updateMany({ where: { offeringId, status: 'UNDER_REVIEW' }, data: { status: 'PROPOSED' } });
      await this.audit.log({ actor: user.username, action: 'RANKING_LOCK', entity: 'Offering', entityId: offeringId, after: { asil } }, tx);
    });
    return { ok: true };
  }

  /** Fakülte yönetim kurulu kararının sayısı ve tarihi girilir; öneriler karara dönüşür. */
  async decide(user: AuthUser, offeringId: string, decisionDate: Date, decisionNo: string) {
    const o = await this.catalog.getOffering(offeringId);
    if (!o.rankingLockedAt) throw conflict('Komisyon önerisi kilitlenmeden karar girilemez.');
    const existing = await this.prisma.boardDecision.findFirst({ where: { offeringId } });
    if (existing) throw conflict('Bu teklif için karar zaten girildi.');
    const apps = await this.prisma.application.findMany({ where: { offeringId, status: 'PROPOSED' }, include: { ranking: true } });
    const asil = apps.filter((a) => a.ranking?.proposal === 'ASIL').length;
    if (asil > o.quota) throw conflict('Kabul sayısı kontenjanı aşıyor.');

    const status = { ASIL: 'ACCEPTED', YEDEK: 'WAITLISTED', RET: 'REJECTED' } as const;
    return this.prisma.$transaction(async (tx) => {
      for (const a of apps) await tx.application.update({ where: { id: a.id }, data: { status: status[a.ranking?.proposal ?? 'RET'] } });
      const d = await tx.boardDecision.create({ data: { offeringId, decisionDate, decisionNo, recordedBy: user.username } });
      await this.audit.log({ actor: user.username, action: 'BOARD_DECISION', entity: 'Offering', entityId: offeringId, after: { decisionNo, decisionDate, asil } }, tx);
      return d;
    });
  }

  async publish(user: AuthUser, offeringId: string) {
    const o = await this.catalog.getOffering(offeringId);
    const decision = await this.prisma.boardDecision.findFirst({ where: { offeringId }, orderBy: { recordedAt: 'desc' } });
    if (!decision) throw conflict('Karar kaydedilmeden sonuç yayımlanamaz.');
    if (decision.publishedAt) throw conflict('Sonuçlar zaten yayımlandı.');
    await this.prisma.boardDecision.update({ where: { id: decision.id }, data: { publishedAt: new Date() } });
    await this.audit.log({ actor: user.username, action: 'RESULTS_PUBLISH', entity: 'Offering', entityId: offeringId });

    const apps = await this.prisma.application.findMany({ where: { offeringId, status: { in: ['ACCEPTED', 'WAITLISTED', 'REJECTED'] } }, include: { ranking: true } });
    const users = await this.usernames(apps.map((a) => a.studentNo));
    const track = LABELS.track[o.type].toLowerCase();
    const until = o.registrationDeadline ? ` Son gün: ${o.registrationDeadline.toLocaleDateString('tr-TR')}.` : '';
    for (const a of apps) {
      const text =
        a.status === 'ACCEPTED'
          ? `Bilgisayar Mühendisliği ${track} programına asil olarak kabul edildiniz. Kesin kaydınızı "Başvurularım" sayfasından onaylayın.${until}`
          : a.status === 'WAITLISTED'
            ? `Bilgisayar Mühendisliği ${track} programında ${a.ranking?.rank ?? '-'}. sıradan yedeksiniz. Kontenjan açılırsa bildirim alacaksınız.`
            : `Bilgisayar Mühendisliği ${track} başvurunuz kabul edilmedi.`;
      await this.notifications.notify(users.get(a.studentNo)!, 'Başvuru sonucunuz ilan edildi', text, `/ogrenci/basvuru/${a.id}`);
    }
    return { ok: true, notified: apps.length };
  }

  /**
   * Kesin kayıt: kabul edilen öğrenci kaydını kendisi onaylar (Rehber, "Asil öğrenci kayıtları").
   * Kayıt açılınca komisyon Kabul ve Ders Protokolünü hazırlar ve beş imzaya gönderir.
   */
  async accept(user: AuthUser, applicationId: string) {
    const app = await this.prisma.application.findUnique({ where: { id: applicationId }, include: { offering: true, student: true } });
    if (!app) throw notFound('Başvuru');
    if (app.studentNo !== user.studentNo) throw forbidden();
    const decision = await this.prisma.boardDecision.findFirst({ where: { offeringId: app.offeringId, publishedAt: { not: null } } });
    if (app.status !== 'ACCEPTED' || !decision) throw conflict('Yalnızca kabul edilen (asil ya da yedekten çağrılan) başvurular için kesin kayıt yapılır.');
    if (app.offering.registrationClosedAt) throw conflict('Kayıt dönemi kapatıldı.');
    const enrollment = await this.prisma.$transaction(async (tx) => {
      await tx.application.update({ where: { id: app.id }, data: { status: 'ENROLLED' } });
      const e = await tx.enrollment.create({
        data: {
          studentNo: app.studentNo,
          offeringId: app.offeringId,
          applicationId: app.id,
          type: app.offering.type,
          startTermId: app.offering.termId,
          mainAdvisorUsername: app.student.advisorUsername,
        },
      });
      await this.audit.log({ actor: user.username, action: 'ENROLLMENT_CREATE', entity: 'Enrollment', entityId: e.id, after: { applicationId: app.id } }, tx);
      return e;
    });
    await this.notifications.notifyCoordinators(
      'Yeni kayıt: protokol hazırlanmalı',
      `${app.student.fullName} (${app.studentNo}) ${LABELS.track[app.offering.type].toLowerCase()} kesin kaydını onayladı.`,
      `/kayitlar/${enrollment.id}`,
    );
    return enrollment;
  }

  /** Kayıt süresi biter; kaydolmayan asiller düşer, sıradaki yedekler çağrılır. */
  async closeRegistration(user: AuthUser, offeringId: string) {
    const o = await this.catalog.getOffering(offeringId);
    if (o.registrationClosedAt) throw conflict('Kayıt dönemi zaten kapatıldı.');
    const published = await this.prisma.boardDecision.findFirst({ where: { offeringId, publishedAt: { not: null } } });
    if (!published) throw conflict('Sonuçlar yayımlanmadan kayıt dönemi kapatılamaz.');
    const dropped = await this.prisma.application.findMany({ where: { offeringId, status: 'ACCEPTED' } });
    const enrolled = await this.prisma.application.count({ where: { offeringId, status: 'ENROLLED' } });
    const seats = Math.max(0, o.quota - enrolled);
    const waitlist = await this.prisma.application.findMany({ where: { offeringId, status: 'WAITLISTED' }, include: { ranking: true }, orderBy: { ranking: { rank: 'asc' } }, take: seats });
    await this.prisma.$transaction(async (tx) => {
      await tx.application.updateMany({ where: { id: { in: dropped.map((d) => d.id) } }, data: { status: 'NOT_ENROLLED' } });
      for (const w of waitlist) await tx.application.update({ where: { id: w.id }, data: { status: 'ACCEPTED' } });
      // Yedek çağrıldıysa kayıt dönemi yedekler için açık kalır; çağrılan yoksa kapanır.
      if (!waitlist.length) await tx.offering.update({ where: { id: offeringId }, data: { registrationClosedAt: new Date() } });
      await this.audit.log(
        { actor: user.username, action: 'REGISTRATION_CLOSE', entity: 'Offering', entityId: offeringId, after: { dropped: dropped.map((d) => d.studentNo), promoted: waitlist.map((w) => w.studentNo) } },
        tx,
      );
    });
    const users = await this.usernames(waitlist.map((w) => w.studentNo));
    const until = o.waitlistDeadline ? ` Son gün: ${o.waitlistDeadline.toLocaleDateString('tr-TR')}.` : '';
    for (const w of waitlist) {
      await this.notifications.notify(
        users.get(w.studentNo)!,
        'Yedekten asil listeye geçtiniz',
        `Bilgisayar Mühendisliği ${LABELS.track[o.type].toLowerCase()} programında kontenjan açıldı. Kesin kaydınızı "Başvurularım" sayfasından onaylayın.${until}`,
        `/ogrenci/basvuru/${w.id}`,
      );
    }
    return { dropped: dropped.length, promoted: waitlist.map((w) => w.studentNo), closed: !waitlist.length };
  }

  /** İlan edilecek sonuç listesi (öğrenci numarası ve ad maskeli). */
  async publicResult(offeringId: string) {
    const data = await this.applications(offeringId);
    if (!data.decision) throw badRequest('Karar girilmeden sonuç listesi oluşturulamaz.');
    return {
      offering: data.offering,
      decision: data.decision,
      rows: data.rows
        .filter((r) => r.ranking && r.ranking.proposal !== 'RET')
        .map((r) => ({ rank: r.ranking!.rank, studentNo: maskNo(r.studentNo), fullName: maskName(r.fullName), mainProgramName: r.mainProgramName, gano: r.gano, proposal: r.ranking!.proposal })),
    };
  }

  async export(offeringId: string, format: 'csv' | 'xlsx') {
    const data = await this.applications(offeringId);
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
    const name = `Bilgisayar Muhendisligi ${LABELS.track[data.offering.type]} ${data.offering.term.year}`;
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
}
