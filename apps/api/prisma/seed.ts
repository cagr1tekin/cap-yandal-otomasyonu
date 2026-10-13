/**
 * Geliştirme verisi (yalnızca sentetik). Her çalıştırmada tabloları boşaltıp yeniden doldurur.
 * Geçmiş dönem kayıtları koordinatörün sistem açılışındaki geriye dönük girişinin karşılığıdır.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_RULE_SETS } from '@cap/rules';
import { COURSES, CURRENT_TERM_ID, DEV_PASSWORD, PROGRAMS, STUDENTS, TEMPLATES, TERMS, USERS, studentEmail, type SeedStudent } from '@cap/seed-data';
import { hashPassword } from '../src/auth/password';
import { AuditService } from '../src/audit/audit.service';
import type { NotificationsService } from '../src/notifications/notifications';
import type { PrismaService } from '../src/prisma/prisma.service';
import { ChecksService } from '../src/rules/checks.service';
import { RulesService } from '../src/rules/rules.service';
import { resultForGrade } from '../src/curriculum/progress';

const prisma = new PrismaClient();
const STORAGE = resolve(process.env.UPLOAD_DIR ?? './storage');
const IN_DB = process.env.STORAGE_DRIVER === 'db';
/** Deneme hesaplarının şifresi: barındırmada SEED_PASSWORD, yerelde DEV_PASSWORD. */
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? DEV_PASSWORD;
const COORD = 'koord.bilgisayar';
const SETUP = new Date('2026-09-10T10:00:00+03:00');

/** Deneme belgesi: tek sayfalık, geçerli en küçük PDF. */
function placeholderPdf(title: string) {
  const text = `BT /F1 14 Tf 60 780 Td (${title.replace(/[^\x20-\x7E]/g, '?')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

async function seedStudent(s: SeedStudent) {
  const user = await prisma.user.findUniqueOrThrow({ where: { username: s.studentNo } });
  await prisma.student.create({
    data: {
      studentNo: s.studentNo,
      userId: user.id,
      fullName: s.fullName,
      schoolEmail: studentEmail(s.studentNo),
      track: s.track,
      admissionTermId: s.admissionTermId,
      mainProgramId: s.mainProgramId,
      commonEcts: s.templateId ? (TEMPLATES.find((t) => t.id === s.templateId)?.commonEcts ?? 0) : 0,
      source: 'BACKFILL',
      createdBy: COORD,
      createdAt: SETUP,
    },
  });
  if (s.invited) await prisma.user.update({ where: { id: user.id }, data: { invitedAt: SETUP } });

  // Ders listesi: şablondan (onaylı) ya da öğrencinin girdiği (onay bekliyor).
  const template = TEMPLATES.find((t) => t.id === s.templateId);
  for (const i of template?.items ?? []) {
    await prisma.planItem.create({
      data: { studentNo: s.studentNo, kind: i.kind, courseCode: i.code, name: i.name, ects: i.ects, semester: i.semester, status: 'APPROVED', source: 'BACKFILL', addReason: `Kurulum: ${template!.title}`, createdBy: COORD, createdAt: SETUP, reviewedBy: COORD, reviewedAt: SETUP },
    });
  }
  for (const code of s.pendingPlan ?? []) {
    const c = COURSES.find((x) => x.code === code)!;
    await prisma.planItem.create({ data: { studentNo: s.studentNo, kind: 'COURSE', courseCode: c.code, name: c.name, ects: c.ects, semester: c.semester, status: 'PENDING', source: 'STUDENT', createdBy: s.studentNo } });
  }

  // Denemeler: ders satırına, yoksa aynı yarıyılın boş seçmeli yerine bağlanır.
  const plan = await prisma.planItem.findMany({ where: { studentNo: s.studentNo }, include: { attempts: true } });
  const usedSlots = new Set<string>();
  for (const a of s.attempts) {
    const c = COURSES.find((x) => x.code === a.code)!;
    let item = plan.find((p) => p.courseCode === a.code);
    if (!item) {
      item = plan.find((p) => p.kind === 'ELECTIVE_SLOT' && p.semester === c.semester && !usedSlots.has(p.id));
      if (!item) throw new Error(`${s.studentNo}: ${a.code} için liste satırı yok`);
      usedSlots.add(item.id);
    }
    const pending = a.status === 'PENDING';
    await prisma.courseAttempt.create({
      data: {
        studentNo: s.studentNo,
        planItemId: item.id,
        termId: a.termId,
        courseCode: c.code,
        courseName: c.name,
        ects: c.ects,
        status: pending ? 'PENDING' : 'APPROVED',
        source: pending ? 'STUDENT' : a.termId === CURRENT_TERM_ID ? 'COORDINATOR' : 'BACKFILL',
        grade: a.grade ?? null,
        // DC şartlı geçer: deneme verisinde başarılı sayıldı.
        result: resultForGrade(a.grade, true),
        gradedAt: a.grade ? SETUP : null,
        createdBy: pending ? s.studentNo : COORD,
        ...(pending ? {} : { reviewedBy: COORD, reviewedAt: SETUP }),
      },
    });
  }

  for (const g of s.gano) {
    await prisma.ganoRecord.create({ data: { studentNo: s.studentNo, termId: g.termId, gano: g.gano, source: 'TRANSKRIPT', sourceNote: 'Kurulum: transkriptten', mainFrozen: g.mainFrozen ?? false, mainGraduated: g.mainGraduated ?? false, enteredBy: COORD, createdAt: SETUP } });
  }

  if (!IN_DB) mkdirSync(join(STORAGE, s.studentNo), { recursive: true });
  for (const [i, d] of s.documents.entries()) {
    const file = placeholderPdf(`Sentetik belge - ${d.kind} - ${s.studentNo}`);
    const storageKey = `${s.studentNo}/seed-${i}.pdf`;
    if (IN_DB) await prisma.documentFile.create({ data: { storageKey, data: new Uint8Array(file) } });
    else writeFileSync(join(STORAGE, storageKey), file);
    const pending = d.status === 'PENDING';
    await prisma.document.create({
      data: {
        studentNo: s.studentNo,
        kind: d.kind as 'PROTOKOL',
        termId: d.termId ?? null,
        fileName: `${d.kind.toLowerCase().replace(/_/g, '-')}${d.termId ? `-${d.termId.toLowerCase()}` : ''}.pdf`,
        mimeType: 'application/pdf',
        size: file.length,
        sha256: createHash('sha256').update(file).digest('hex'),
        storageKey,
        status: d.status,
        uploadedBy: s.studentNo,
        ...(pending ? {} : { reviewedBy: COORD, reviewedAt: SETUP }),
      },
    });
  }
}

async function main() {
  const tables = (await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\_prisma%'`).map((t) => t.tablename);
  // TRUNCATE satır tetikleyicilerini çalıştırmaz; silinmezlik ve denetim kaydı yalnızca seed ile sıfırlanabilir.
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
  if (!IN_DB) rmSync(STORAGE, { recursive: true, force: true });

  await prisma.program.createMany({ data: PROGRAMS.map((p) => ({ id: p.id, name: p.name, faculty: p.faculty, codePrefix: p.codePrefix, isHome: p.isHome })) });
  await prisma.course.createMany({ data: COURSES.map((c) => ({ ...c, updatedBy: 'seed' })) });
  await prisma.term.createMany({
    data: TERMS.map((t) => ({ id: t.id, year: t.year, season: t.season, startsAt: new Date(`${t.startsAt}T00:00:00+03:00`), endsAt: new Date(`${t.endsAt}T23:59:59+03:00`), isCurrent: t.id === CURRENT_TERM_ID })),
  });
  for (const set of DEFAULT_RULE_SETS) {
    await prisma.ruleSet.create({
      data: {
        version: set.version,
        type: set.type,
        effectiveFrom: new Date(set.effectiveFrom),
        status: 'ACTIVE',
        note: 'Varsayılan kural seti (yönergeler)',
        createdBy: 'seed',
        rules: { create: set.rules.map((r, i) => ({ code: r.code, kind: r.kind, article: r.article, title: r.title, phase: r.phase, params: r.params as object, position: i })) },
      },
    });
  }
  for (const t of TEMPLATES) {
    await prisma.protocolTemplate.create({
      data: {
        id: t.id,
        type: t.type,
        sourceProgramId: t.sourceProgramId,
        title: t.title,
        commonEcts: t.commonEcts,
        source: t.source,
        updatedBy: 'seed',
        items: { create: t.items.map((i, position) => ({ position, ...i })) },
        conditions: { create: t.conditions.map((c) => ({ ...c, note: c.note ?? null })) },
      },
    });
  }
  const passwordHash = await hashPassword(SEED_PASSWORD);
  for (const u of USERS) {
    await prisma.user.create({ data: { username: u.username, displayName: u.displayName, email: u.email, role: u.role, passwordHash, createdBy: 'seed', invitedAt: u.role === 'OGRENCI' ? null : SETUP } });
  }
  for (const s of STUDENTS) await seedStudent(s);

  // Açılış kural kontrolleri (bildirim gönderilmez).
  const audit = new AuditService(prisma as unknown as PrismaService);
  const silent = { notify: async () => undefined, notifyCoordinators: async () => undefined } as unknown as NotificationsService;
  const checks = new ChecksService(prisma as unknown as PrismaService, new RulesService(prisma as unknown as PrismaService, audit), audit, silent);
  for (const s of STUDENTS) await checks.run(s.studentNo, 'KURULUM', 'sistem');

  console.log('Seed tamam:', {
    ders: await prisma.course.count(),
    sablon: await prisma.protocolTemplate.count(),
    kullanici: await prisma.user.count(),
    ogrenci: await prisma.student.count(),
    listeSatiri: await prisma.planItem.count(),
    deneme: await prisma.courseAttempt.count(),
    kontrol: await prisma.ruleCheck.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
