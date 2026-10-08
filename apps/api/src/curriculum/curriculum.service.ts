import { Injectable } from '@nestjs/common';
import { LABELS, type BackfillSchema, type ExemptSchema, type GradeSubmissionSchema } from '@cap/contracts';
import type { CourseAttempt, Prisma, RecordSource } from '@prisma/client';
import type { z } from 'zod';
import type { AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../common/http';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { ChecksService } from '../rules/checks.service';
import { resultForGrade } from './progress';

type Tx = Prisma.TransactionClient | PrismaService;

const LIVE: ('PENDING' | 'APPROVED')[] = ['PENDING', 'APPROVED'];

/**
 * Ders takibi: öğrencinin alacağı dersler (liste), her dersin dönem dönem alınışı (deneme) ve notlar.
 * Öğrencinin girdiği kayıt "onay bekliyor" başlar, koordinatör onaylayınca kilitlenir. Koordinatörün girdiği
 * kayıt doğrudan onaylıdır. Elle giriş, geriye dönük giriş ve dışarıdan aktarım aynı yöntemlerden geçer.
 */
@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
    private readonly checks: ChecksService,
  ) {}

  private requireReason(user: AuthUser, reason: string | undefined, what: string) {
    if (user.role === 'KOORDINATOR' && (!reason || reason.trim().length < 5)) throw unprocessable(`${what} için gerekçe yazın (en az 5 karakter).`);
  }

  private async item(id: string) {
    const it = await this.prisma.planItem.findUnique({ where: { id }, include: { attempts: { include: { term: true } } } });
    if (!it) throw notFound('Ders listesi satırı');
    return it;
  }

  private async attempt(id: string) {
    const a = await this.prisma.courseAttempt.findUnique({ where: { id }, include: { term: true, planItem: true } });
    if (!a) throw notFound('Ders kaydı');
    return a;
  }

  private notifyStaffOfStudentEntry(user: AuthUser, studentNo: string, what: string) {
    if (user.role !== 'OGRENCI') return Promise.resolve();
    return this.notifications.notifyCoordinators('Onay bekleyen kayıt', `${studentNo}: ${what}`, `/ogrenciler/${studentNo}?sekme=dersler`);
  }

  // ---------------- Ders listesi ----------------

  /** Listeye ders ekler. Öğrenci yalnız katalogdan seçer; katalogda olmayan ders için talep gönderir. */
  async addPlanItem(user: AuthUser, studentNo: string, input: { courseCode: string; reason?: string }, source?: RecordSource, tx: Tx = this.prisma) {
    await this.access.writable(user, studentNo);
    if (!source) this.requireReason(user, input.reason, 'Listeye ders eklemek');
    const course = await this.catalog.course(input.courseCode, tx);
    if (!course.active) throw conflict(`${course.code} ${course.name} pasife alınmış; listeye eklenemez.`);
    const dup = await tx.planItem.findFirst({ where: { studentNo, courseCode: course.code, removedAt: null, status: { in: LIVE } } });
    if (dup) throw conflict(`${course.code} zaten listede.`);
    const staff = user.role === 'KOORDINATOR';
    const it = await tx.planItem.create({
      data: {
        studentNo,
        kind: 'COURSE',
        courseCode: course.code,
        name: course.name,
        ects: course.ects,
        semester: course.semester,
        status: staff ? 'APPROVED' : 'PENDING',
        source: source ?? (staff ? 'COORDINATOR' : 'STUDENT'),
        addReason: input.reason ?? null,
        createdBy: user.username,
        ...(staff ? { reviewedBy: user.username, reviewedAt: new Date() } : {}),
      },
    });
    await this.audit.log(user, { action: 'PLAN_ADD', entity: 'PlanItem', entityId: it.id, studentNo, after: { courseCode: it.courseCode, status: it.status, source: it.source }, reason: input.reason }, tx);
    if (tx === this.prisma) {
      await this.notifyStaffOfStudentEntry(user, studentNo, `listeye ${course.code} ${course.name} eklendi`);
      if (staff) await this.checks.run(studentNo, 'LISTE_DEGISTI', user);
    }
    return it;
  }

  /** Şablondaki (bölümler arası protokol) dersleri ve seçmeli ders yerlerini listeye ekler. */
  async applyTemplate(user: AuthUser, studentNo: string, templateId: string, reason: string) {
    const s = await this.access.writable(user, studentNo);
    const t = await this.prisma.protocolTemplate.findUnique({ where: { id: templateId }, include: { items: { where: { active: true }, orderBy: { position: 'asc' } } } });
    if (!t) throw notFound('Şablon');
    if (t.type !== s.track) throw conflict(`Bu şablon ${LABELS.trackShort[t.type]} içindir; öğrenci ${LABELS.trackShort[s.track]}.`);
    const existing = await this.prisma.planItem.findMany({ where: { studentNo, removedAt: null, status: { in: LIVE } } });
    const codes = new Set(existing.map((e) => e.courseCode));
    const slotCount = (sem: number) => existing.filter((e) => e.kind === 'ELECTIVE_SLOT' && e.semester === sem).length;
    const added: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      const seenSlots: Record<number, number> = {};
      for (const i of t.items) {
        if (i.kind === 'COURSE') {
          if (codes.has(i.code)) continue;
          const c = await this.catalog.course(i.code!, tx);
          await tx.planItem.create({ data: { studentNo, kind: 'COURSE', courseCode: c.code, name: c.name, ects: c.ects, semester: c.semester, status: 'APPROVED', source: 'COORDINATOR', addReason: reason, createdBy: user.username, reviewedBy: user.username, reviewedAt: new Date() } });
          added.push(c.code);
        } else {
          seenSlots[i.semester] = (seenSlots[i.semester] ?? 0) + 1;
          if (seenSlots[i.semester] <= slotCount(i.semester)) continue;
          await tx.planItem.create({ data: { studentNo, kind: 'ELECTIVE_SLOT', name: i.name, ects: i.ects, semester: i.semester, status: 'APPROVED', source: 'COORDINATOR', addReason: reason, createdBy: user.username, reviewedBy: user.username, reviewedAt: new Date() } });
          added.push(i.name);
        }
      }
      if (s.track === 'CAP' && s.commonEcts === 0 && t.commonEcts > 0) await tx.student.update({ where: { studentNo }, data: { commonEcts: t.commonEcts } });
      await this.audit.log(user, { action: 'PLAN_FROM_TEMPLATE', entity: 'Student', entityId: studentNo, studentNo, after: { templateId, added }, reason }, tx);
    });
    await this.checks.run(studentNo, 'LISTE_DEGISTI', user);
    return { added: added.length };
  }

  /** Dersi listeden çıkarır (silinmez, "çıkarıldı" olarak kalır). Geçilmiş ders ve notlar etkilenmez. */
  async removePlanItem(user: AuthUser, id: string, reason: string) {
    const it = await this.item(id);
    await this.access.writable(user, it.studentNo);
    if (it.removedAt) throw conflict('Ders zaten listeden çıkarılmış.');
    if (it.status !== 'APPROVED') throw conflict('Onaylanmamış satır çıkarılmaz; reddedin ya da iptal edin.');
    if (it.attempts.some((a) => a.status === 'APPROVED' && a.result === 'PASSED')) throw conflict('Geçilmiş ders listeden çıkarılamaz; notu ve dönemi kayıtta kalır.');
    await this.prisma.$transaction(async (tx) => {
      await tx.planItem.update({ where: { id }, data: { removedAt: new Date(), removedBy: user.username, removeReason: reason } });
      const open = it.attempts.filter((a) => a.status === 'PENDING');
      for (const a of open) await tx.courseAttempt.update({ where: { id: a.id }, data: { status: 'CANCELLED', reviewedBy: user.username, reviewedAt: new Date(), reviewNote: 'Ders listeden çıkarıldı' } });
      await this.audit.log(user, { action: 'PLAN_REMOVE', entity: 'PlanItem', entityId: id, studentNo: it.studentNo, before: { courseCode: it.courseCode, name: it.name }, after: { cancelledAttempts: open.length }, reason }, tx);
    });
    await this.checks.run(it.studentNo, 'LISTE_DEGISTI', user);
    return { ok: true };
  }

  /** Muafiyet (ör. protokoldeki özel şart). Ders AKTS'ye sayılır, ortalamaya girmez. */
  async exempt(user: AuthUser, id: string, input: z.infer<typeof ExemptSchema>) {
    const it = await this.item(id);
    await this.access.writable(user, it.studentNo);
    if (it.removedAt || it.status !== 'APPROVED') throw conflict('Yalnızca listedeki onaylı ders muaf sayılabilir.');
    if (it.exemptAt) throw conflict('Ders zaten muaf.');
    if (it.attempts.some((a) => a.status === 'APPROVED' && a.result === 'PASSED')) throw conflict('Geçilmiş ders muaf sayılmaz.');
    if (input.documentId) {
      const d = await this.prisma.document.findUnique({ where: { id: input.documentId } });
      if (!d || d.studentNo !== it.studentNo) throw badRequest('Belge bu öğrenciye ait değil.');
    }
    await this.prisma.planItem.update({ where: { id }, data: { exemptAt: new Date(), exemptBy: user.username, exemptReason: input.reason, exemptCondNo: input.conditionNo ?? null } });
    await this.audit.log(user, { action: 'PLAN_EXEMPT', entity: 'PlanItem', entityId: id, studentNo: it.studentNo, after: { conditionNo: input.conditionNo, documentId: input.documentId }, reason: input.reason });
    await this.checks.run(it.studentNo, 'MUAFIYET', user);
    return { ok: true };
  }

  async unexempt(user: AuthUser, id: string, reason: string) {
    const it = await this.item(id);
    await this.access.writable(user, it.studentNo);
    if (!it.exemptAt) throw conflict('Ders muaf değil.');
    await this.prisma.planItem.update({ where: { id }, data: { exemptAt: null, exemptBy: null, exemptReason: null, exemptCondNo: null } });
    await this.audit.log(user, { action: 'PLAN_UNEXEMPT', entity: 'PlanItem', entityId: id, studentNo: it.studentNo, before: { exemptReason: it.exemptReason, exemptCondNo: it.exemptCondNo }, reason });
    await this.checks.run(it.studentNo, 'MUAFIYET', user);
    return { ok: true };
  }

  // ---------------- Dönem dersleri (denemeler) ----------------

  /** Denemenin hangi dersle yapılacağı: ders satırında dersin kendisi, seçmeli yerinde katalogdan seçilen ders. */
  private async attemptCourse(user: AuthUser, it: Awaited<ReturnType<CurriculumService['item']>>, courseCode: string | undefined, tx: Tx) {
    if (it.kind === 'COURSE') return this.catalog.course(it.courseCode!, tx);
    if (!courseCode) throw unprocessable(`${it.name}: bu yere alınan dersi katalogdan seçin.`);
    const c = await this.catalog.course(courseCode, tx);
    if (!c.active && user.role === 'OGRENCI') throw conflict(`${c.code} pasife alınmış.`);
    if (user.role === 'OGRENCI' && (c.kind !== 'TEKNIK_SECMELI' || c.semester !== it.semester)) {
      throw unprocessable(`${it.name} yerine yalnızca ${it.semester}. yarıyılın teknik seçmeli dersleri yazılabilir.`);
    }
    const inPlan = await tx.planItem.findFirst({ where: { studentNo: it.studentNo, courseCode: c.code, removedAt: null, status: { in: LIVE } } });
    const usedInSlot = await tx.courseAttempt.findFirst({
      where: { studentNo: it.studentNo, courseCode: c.code, planItemId: { not: it.id }, status: { in: LIVE } },
    });
    if (inPlan || usedInSlot) throw conflict(`${c.code} listede ya da başka bir seçmeli yerinde zaten var.`);
    return c;
  }

  private async assertAttemptable(it: Awaited<ReturnType<CurriculumService['item']>>, termId: string) {
    if (it.status !== 'APPROVED' || it.removedAt) throw conflict('Ders listede onaylı olmalı.');
    if (it.exemptAt) throw conflict('Muaf sayılan ders alınmaz.');
    if (it.attempts.some((a) => a.status === 'APPROVED' && a.result === 'PASSED')) throw conflict('Bu ders geçilmiş.');
    if (it.attempts.some((a) => LIVE.includes(a.status as 'PENDING') && a.termId === termId)) throw conflict('Ders bu dönem için zaten girilmiş.');
    if (it.attempts.some((a) => a.status === 'APPROVED' && a.result === 'TAKEN' && a.termId !== termId)) {
      throw conflict('Dersin önceki dönemdeki notu girilmeden yeniden alınamaz.');
    }
  }

  /** Öğrenci içinde bulunulan dönemde aldığı dersi girer; koordinatör herhangi bir dönem için girebilir. */
  async addAttempt(user: AuthUser, studentNo: string, input: { planItemId: string; termId: string; courseCode?: string }) {
    await this.access.writable(user, studentNo);
    const it = await this.item(input.planItemId);
    if (it.studentNo !== studentNo) throw notFound('Ders listesi satırı');
    const term = await this.catalog.term(input.termId);
    if (user.role === 'OGRENCI' && !term.isCurrent) throw conflict('Öğrenci yalnızca içinde bulunulan dönemin derslerini girer.');
    if (term.startsAt > new Date() && !term.isCurrent) throw conflict('Henüz başlamamış dönem için ders girilemez.');
    await this.assertAttemptable(it, term.id);
    const staff = user.role === 'KOORDINATOR';
    const a = await this.prisma.$transaction(async (tx) => {
      const c = await this.attemptCourse(user, it, input.courseCode, tx);
      const created = await tx.courseAttempt.create({
        data: {
          studentNo,
          planItemId: it.id,
          termId: term.id,
          courseCode: c.code,
          courseName: c.name,
          ects: c.ects,
          status: staff ? 'APPROVED' : 'PENDING',
          source: staff ? 'COORDINATOR' : 'STUDENT',
          createdBy: user.username,
          ...(staff ? { reviewedBy: user.username, reviewedAt: new Date() } : {}),
        },
      });
      await this.audit.log(user, { action: 'ATTEMPT_ADD', entity: 'CourseAttempt', entityId: created.id, studentNo, after: { termId: term.id, courseCode: c.code, status: created.status } }, tx);
      return created;
    });
    await this.notifyStaffOfStudentEntry(user, studentNo, `${term.year} ${term.season === 'GUZ' ? 'Güz' : 'Bahar'} dönemi için ${a.courseCode} girildi`);
    if (staff) await this.checks.run(studentNo, 'DONEM_DERSI', user);
    return a;
  }

  /**
   * Geriye dönük giriş (sistem açılışındaki mevcut öğrenciler, dışarıdan aktarım): dönem ve notla birlikte
   * doğrudan onaylı yazılır; onay kilidine takılmaz.
   */
  async backfill(user: AuthUser, studentNo: string, input: z.infer<typeof BackfillSchema>, source: RecordSource = 'BACKFILL', tx?: Tx, runCheck = true) {
    this.access.assertCoordinator(user);
    const db = tx ?? this.prisma;
    const it = await db.planItem.findUnique({ where: { id: input.planItemId }, include: { attempts: { include: { term: true } } } });
    if (!it || it.studentNo !== studentNo) throw notFound('Ders listesi satırı');
    const term = await this.catalog.term(input.termId);
    await this.assertAttemptable(it, term.id);
    const work = async (t: Tx) => {
      const c = await this.attemptCourse(user, it, input.courseCode, t);
      const result = resultForGrade(input.grade, input.passed);
      const a = await t.courseAttempt.create({
        data: {
          studentNo,
          planItemId: it.id,
          termId: term.id,
          courseCode: c.code,
          courseName: c.name,
          ects: c.ects,
          status: 'APPROVED',
          source,
          grade: input.grade ?? null,
          result,
          gradedAt: input.grade ? new Date() : null,
          createdBy: user.username,
          reviewedBy: user.username,
          reviewedAt: new Date(),
          reviewNote: input.note ?? null,
        },
      });
      await this.audit.log(user, { action: 'ATTEMPT_BACKFILL', entity: 'CourseAttempt', entityId: a.id, studentNo, after: { termId: term.id, courseCode: c.code, grade: a.grade, result, source } }, t);
      return a;
    };
    const a = tx ? await work(tx) : await this.prisma.$transaction(work);
    if (runCheck) await this.checks.run(studentNo, 'GERIYE_DONUK_GIRIS', user);
    return a;
  }

  /** Onaylı kaydın düzeltilmesi yalnızca koordinatördedir; eski ve yeni değer işlem kaydına yazılır. */
  async correctAttempt(user: AuthUser, id: string, input: { termId?: string; grade?: string | null; passed?: boolean; reason: string }) {
    this.access.assertCoordinator(user);
    const a = await this.attempt(id);
    if (a.status === 'CANCELLED' || a.status === 'REJECTED') throw conflict('İptal edilmiş ya da reddedilmiş kayıt düzeltilmez.');
    if (input.termId) await this.catalog.term(input.termId);
    const grade = input.grade === undefined ? a.grade : input.grade;
    const data = {
      termId: input.termId ?? a.termId,
      grade,
      result: resultForGrade(grade, input.passed ?? (a.result === 'PASSED')),
      gradedAt: grade ? (a.gradedAt ?? new Date()) : null,
      correctedAt: new Date(),
      correctedBy: user.username,
    };
    const updated = await this.prisma.courseAttempt.update({ where: { id }, data });
    await this.audit.log(user, { action: 'ATTEMPT_CORRECT', entity: 'CourseAttempt', entityId: id, studentNo: a.studentNo, before: { termId: a.termId, grade: a.grade, result: a.result }, after: { termId: data.termId, grade: data.grade, result: data.result }, reason: input.reason });
    await this.checks.run(a.studentNo, 'DUZELTME', user);
    return updated;
  }

  // ---------------- Dönem sonu notları ----------------

  /**
   * Dönem sonu not gönderimi. Bölümde alınan derslerin not belgesi (ÇAP / YDP transkripti) o döneme ait
   * olarak yüklenmeden notlar onaya gönderilemez. Koordinatörün gönderdiği not doğrudan onaylanır.
   */
  async submitGrades(user: AuthUser, studentNo: string, input: z.infer<typeof GradeSubmissionSchema>) {
    await this.access.writable(user, studentNo);
    const term = await this.catalog.term(input.termId);
    if (term.startsAt > new Date()) throw conflict('Başlamamış dönem için not girilemez.');
    const doc = await this.prisma.document.findUnique({ where: { id: input.transcriptId } });
    if (!doc || doc.studentNo !== studentNo || doc.kind !== 'CAP_TRANSKRIPT' || doc.termId !== term.id) {
      throw unprocessable('Seçilen belge bu dönemin ÇAP / YDP not belgesi değil. Önce belgeyi bu dönem için yükleyin.');
    }
    if (doc.status === 'REJECTED' || doc.status === 'CANCELLED') throw unprocessable('Not belgesi reddedilmiş ya da iptal edilmiş; yeni sürümünü yükleyin.');
    if (new Set(input.grades.map((g) => g.attemptId)).size !== input.grades.length) throw badRequest('Bir ders iki kez gönderilemez.');
    const attempts = await this.prisma.courseAttempt.findMany({ where: { id: { in: input.grades.map((g) => g.attemptId) } } });
    for (const g of input.grades) {
      const a = attempts.find((x) => x.id === g.attemptId);
      if (!a || a.studentNo !== studentNo) throw notFound('Ders kaydı');
      if (a.termId !== term.id) throw unprocessable(`${a.courseCode} bu döneme ait değil.`);
      if (a.status !== 'APPROVED') throw unprocessable(`${a.courseCode} dönem kaydı onaylanmadan notu girilemez.`);
      if (a.result !== 'TAKEN') throw conflict(`${a.courseCode} için not zaten işlenmiş; düzeltme için koordinatöre yazın.`);
    }
    const pending = await this.prisma.gradeSubmission.findFirst({ where: { studentNo, termId: term.id, status: 'PENDING' } });
    if (pending) throw conflict('Bu dönem için onay bekleyen bir not gönderimi var.');

    const staff = user.role === 'KOORDINATOR';
    const sub = await this.prisma.$transaction(async (tx) => {
      const created = await tx.gradeSubmission.create({
        data: {
          studentNo,
          termId: term.id,
          transcriptId: doc.id,
          status: 'PENDING',
          submittedBy: user.username,
          items: { create: input.grades.map((g) => ({ attemptId: g.attemptId, grade: g.grade })) },
        },
      });
      await this.audit.log(user, { action: 'GRADES_SUBMIT', entity: 'GradeSubmission', entityId: created.id, studentNo, after: { termId: term.id, transcriptId: doc.id, grades: input.grades } }, tx);
      return created;
    });
    if (staff) return this.reviewGrades(user, sub.id, { decision: 'APPROVED', conditionalPass: [] });
    await this.notifyStaffOfStudentEntry(user, studentNo, `${term.year} ${term.season === 'GUZ' ? 'Güz' : 'Bahar'} dönem sonu notları ve not belgesi gönderildi`);
    return sub;
  }

  /** Koordinatör notları not belgesiyle karşılaştırıp onaylar ya da gerekçesiyle reddeder. */
  async reviewGrades(user: AuthUser, id: string, input: { decision: 'APPROVED' | 'REJECTED'; note?: string; conditionalPass: string[] }) {
    this.access.assertCoordinator(user);
    const sub = await this.prisma.gradeSubmission.findUnique({ where: { id }, include: { items: { include: { attempt: true } }, transcript: true, term: true } });
    if (!sub) throw notFound('Not gönderimi');
    if (sub.status !== 'PENDING') throw conflict('Bu gönderim için zaten karar verildi.');
    await this.prisma.$transaction(async (tx) => {
      await tx.gradeSubmission.update({ where: { id }, data: { status: input.decision, reviewedBy: user.username, reviewedAt: new Date(), reviewNote: input.note ?? null } });
      if (input.decision === 'APPROVED') {
        for (const item of sub.items) {
          if (item.attempt.status !== 'APPROVED' || item.attempt.result !== 'TAKEN') throw conflict(`${item.attempt.courseCode} kaydı değişmiş; gönderimi reddedip yeniden isteyin.`);
          const result = resultForGrade(item.grade, input.conditionalPass.includes(item.attemptId));
          await tx.gradeSubmissionItem.update({ where: { id: item.id }, data: { passed: result === 'PASSED' } });
          await tx.courseAttempt.update({ where: { id: item.attemptId }, data: { grade: item.grade, result, gradedAt: new Date() } });
        }
        if (sub.transcript.status === 'PENDING') {
          await tx.document.update({ where: { id: sub.transcriptId }, data: { status: 'APPROVED', reviewedBy: user.username, reviewedAt: new Date(), reviewNote: 'Not gönderimiyle birlikte onaylandı' } });
        }
      }
      await this.audit.log(user, { action: `GRADES_${input.decision}`, entity: 'GradeSubmission', entityId: id, studentNo: sub.studentNo, after: { conditionalPass: input.conditionalPass }, reason: input.note }, tx);
    });
    const s = await this.prisma.student.findUniqueOrThrow({ where: { studentNo: sub.studentNo }, include: { user: true } });
    const termName = `${sub.term.year} ${sub.term.season === 'GUZ' ? 'Güz' : 'Bahar'}`;
    if (s.user && user.username !== s.user.username) {
      await this.notifications.notify(
        s.user.username,
        input.decision === 'APPROVED' ? 'Dönem notlarınız onaylandı' : 'Dönem notlarınız reddedildi',
        input.decision === 'APPROVED' ? `${termName} notlarınız onaylandı ve kilitlendi.` : `${termName} not gönderiminiz reddedildi: ${input.note}`,
        `/ogrenciler/${sub.studentNo}?sekme=notlar`,
      );
    }
    if (input.decision === 'APPROVED') await this.checks.run(sub.studentNo, 'DONEM_SONU_NOTLARI', user);
    return this.prisma.gradeSubmission.findUniqueOrThrow({ where: { id } });
  }

  // ---------------- Onay, ret, iptal ----------------

  async reviewPlanItem(user: AuthUser, id: string, decision: 'APPROVED' | 'REJECTED', note?: string) {
    this.access.assertCoordinator(user);
    const it = await this.item(id);
    if (it.status !== 'PENDING') throw conflict('Bu kayıt için zaten karar verildi.');
    if (decision === 'APPROVED' && it.courseCode) {
      const c = await this.catalog.course(it.courseCode);
      if (!c.active) throw conflict('Ders pasife alınmış; reddedin.');
    }
    await this.prisma.planItem.update({ where: { id }, data: { status: decision, reviewedBy: user.username, reviewedAt: new Date(), reviewNote: note ?? null } });
    await this.audit.log(user, { action: `PLAN_${decision}`, entity: 'PlanItem', entityId: id, studentNo: it.studentNo, before: { status: it.status }, after: { status: decision }, reason: note });
    if (decision === 'APPROVED') await this.checks.run(it.studentNo, 'LISTE_ONAYI', user);
    return { ok: true, studentNo: it.studentNo, label: `${it.courseCode ?? ''} ${it.name}`.trim() };
  }

  async reviewAttempt(user: AuthUser, id: string, decision: 'APPROVED' | 'REJECTED', note?: string) {
    this.access.assertCoordinator(user);
    const a = await this.attempt(id);
    if (a.status !== 'PENDING') throw conflict('Bu kayıt için zaten karar verildi.');
    if (decision === 'APPROVED' && (a.planItem.removedAt || a.planItem.status !== 'APPROVED')) throw conflict('Ders listede onaylı değil; reddedin.');
    await this.prisma.courseAttempt.update({ where: { id }, data: { status: decision, reviewedBy: user.username, reviewedAt: new Date(), reviewNote: note ?? null } });
    await this.audit.log(user, { action: `ATTEMPT_${decision}`, entity: 'CourseAttempt', entityId: id, studentNo: a.studentNo, before: { status: a.status }, after: { status: decision }, reason: note });
    if (decision === 'APPROVED') await this.checks.run(a.studentNo, 'DONEM_DERSI', user);
    return { ok: true, studentNo: a.studentNo, label: `${a.courseCode} ${a.courseName} (${a.term.year} ${a.term.season === 'GUZ' ? 'Güz' : 'Bahar'})` };
  }

  /**
   * İptal: öğrenci kendi onay bekleyen kaydını geri çekebilir; koordinatör her kaydı gerekçesiyle iptal eder.
   * Kayıt silinmez, "iptal edildi" durumunda kalır.
   */
  async cancel(user: AuthUser, kind: 'plan' | 'attempt' | 'grades', id: string, reason: string) {
    const load = async () => {
      if (kind === 'plan') return this.prisma.planItem.findUnique({ where: { id } });
      if (kind === 'attempt') return this.prisma.courseAttempt.findUnique({ where: { id } });
      return this.prisma.gradeSubmission.findUnique({ where: { id } });
    };
    const row = await load();
    if (!row) throw notFound('Kayıt');
    await this.access.writable(user, row.studentNo, { activeOnly: false });
    if (row.status === 'CANCELLED') throw conflict('Kayıt zaten iptal edilmiş.');
    if (user.role === 'OGRENCI' && row.status !== 'PENDING') throw forbidden('Onaylanan ya da karar verilen kaydı yalnızca koordinatör değiştirebilir.');
    const data = { status: 'CANCELLED' as const, reviewedBy: user.username, reviewedAt: new Date(), reviewNote: reason };
    if (kind === 'plan') await this.prisma.planItem.update({ where: { id }, data });
    else if (kind === 'attempt') await this.prisma.courseAttempt.update({ where: { id }, data });
    else await this.prisma.gradeSubmission.update({ where: { id }, data });
    const entity = kind === 'plan' ? 'PlanItem' : kind === 'attempt' ? 'CourseAttempt' : 'GradeSubmission';
    await this.audit.log(user, { action: `${entity.toUpperCase()}_CANCEL`, entity, entityId: id, studentNo: row.studentNo, before: { status: row.status }, after: { status: 'CANCELLED' }, reason });
    if (row.status === 'APPROVED') await this.checks.run(row.studentNo, 'IPTAL', user);
    return { ok: true };
  }

  // ---------------- Okuma ----------------

  planItems(studentNo: string) {
    return this.prisma.planItem.findMany({
      where: { studentNo },
      include: { attempts: { include: { term: true }, orderBy: { term: { startsAt: 'asc' } } } },
      orderBy: [{ semester: 'asc' }, { kind: 'asc' }, { courseCode: 'asc' }, { createdAt: 'asc' }],
    });
  }

  gradeSubmissions(studentNo: string) {
    return this.prisma.gradeSubmission.findMany({
      where: { studentNo },
      include: { term: true, transcript: { select: { id: true, fileName: true, status: true } }, items: { include: { attempt: { select: { courseCode: true, courseName: true, ects: true } } } } },
      orderBy: { submittedAt: 'desc' },
    });
  }

  /** Not girilebilecek denemeler: onaylı, notsuz, başlamış dönemlerde. */
  async gradeable(studentNo: string): Promise<(CourseAttempt & { term: { id: string; year: string; season: string } })[]> {
    return this.prisma.courseAttempt.findMany({
      where: { studentNo, status: 'APPROVED', result: 'TAKEN', term: { startsAt: { lte: new Date() } } },
      include: { term: true },
      orderBy: [{ term: { startsAt: 'asc' } }, { courseCode: 'asc' }],
    });
  }
}
