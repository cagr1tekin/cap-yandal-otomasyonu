/**
 * Geliştirme verisi. Her çalıştırmada tabloları boşaltıp yeniden doldurur.
 * Kaynak: @cap/seed-data (gerçek müfredat ve protokoller, uydurma öğrenciler) + @cap/rules varsayılan kural setleri.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_RULE_SETS } from '@cap/rules';
import { COURSES, CURRENT_TERM_ID, OFFERINGS, PROGRAMS, STUDENTS, TEMPLATES, TERMS, USERS, YEAR_STATS, studentEmail } from '@cap/seed-data';

const prisma = new PrismaClient();
const STORAGE = resolve(process.env.UPLOAD_DIR ?? './storage');
const SIGNED_AT = new Date('2025-09-25T10:00:00+03:00');
const COORD = 'koord.bilgisayar';

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

async function main() {
  const tables = [
    'AuditLog', 'Notification', 'WithdrawalRequest', 'ScanFinding', '_RuleSetToTermScan', 'TermScan', 'TermLeave', 'TermRecord',
    'Approval', 'ExemptionRequest', 'CourseRegistrationItem', 'CourseRegistration', 'ProtocolCourse', 'Protocol',
    'ProtocolCondition', 'ProtocolTemplateItem', 'ProtocolTemplate', 'Enrollment', 'BoardDecision', 'Ranking',
    'ApplicationDocument', 'Application', 'Document', 'StudentProfile', 'RuleDefinition', 'RuleSet', 'YearStat',
    'OfferingSourceProgram', 'Offering', 'Term', 'Course', 'RoleAssignment', 'User', 'Program',
  ];
  // TRUNCATE satır tetikleyicilerini çalıştırmaz; denetim kaydı yalnızca seed ile sıfırlanabilir.
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
  rmSync(STORAGE, { recursive: true, force: true });

  await prisma.program.createMany({ data: PROGRAMS.map((p) => ({ id: p.id, name: p.name, faculty: p.faculty, codePrefix: p.codePrefix, isHome: p.isHome })) });
  await prisma.course.createMany({ data: COURSES });
  await prisma.term.createMany({
    data: TERMS.map((t) => ({ id: t.id, year: t.year, season: t.season, startsAt: new Date(`${t.startsAt}T00:00:00+03:00`), endsAt: new Date(`${t.endsAt}T23:59:59+03:00`), isCurrent: t.id === CURRENT_TERM_ID })),
  });
  await prisma.yearStat.createMany({ data: YEAR_STATS.map((s) => ({ ...s, updatedBy: 'seed' })) });

  for (const o of OFFERINGS) {
    const current = o.termId === CURRENT_TERM_ID;
    await prisma.offering.create({
      data: {
        id: o.id,
        termId: o.termId,
        type: o.type,
        quota: o.quota,
        firstYearIntake: o.firstYearIntake,
        status: current ? 'PUBLISHED' : 'CLOSED',
        // İçinde bulunulan dönem gösterim için açık; geçen yılın takvimi kapanmış.
        opensAt: new Date(current ? '2026-09-01T09:00:00+03:00' : '2025-08-01T09:00:00+03:00'),
        closesAt: new Date(current ? '2026-12-31T17:00:00+03:00' : '2025-08-15T17:00:00+03:00'),
        announceAt: new Date(current ? '2027-01-05T09:00:00+03:00' : '2025-09-01T09:00:00+03:00'),
        registrationDeadline: new Date(current ? '2027-01-12T17:00:00+03:00' : '2025-09-08T17:00:00+03:00'),
        waitlistDeadline: new Date(current ? '2027-01-15T17:00:00+03:00' : '2025-09-10T17:00:00+03:00'),
        rankingLockedAt: current ? null : new Date('2025-08-20T12:00:00+03:00'),
        registrationClosedAt: current ? null : new Date('2025-09-10T17:00:00+03:00'),
        sourcePrograms: { create: o.sourceProgramIds.map((programId) => ({ programId })) },
      },
    });
  }

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

  for (const u of USERS) {
    await prisma.user.create({
      data: { username: u.username, displayName: u.displayName, email: u.email, assignments: { create: u.assignments.map((a) => ({ role: a.role, programId: a.programId ?? null })) } },
    });
  }

  // Öğrenci bilgileri ve örnek belgeler (öğrencinin "Bilgilerim" ekranında yapacağı işlemlerin karşılığı).
  for (const s of STUDENTS) {
    if (!s.profile) continue;
    const user = await prisma.user.findUniqueOrThrow({ where: { username: s.studentNo } });
    await prisma.studentProfile.create({ data: { studentNo: s.studentNo, userId: user.id, fullName: s.fullName, email: studentEmail(s.studentNo), ...s.profile } });
    mkdirSync(join(STORAGE, s.studentNo), { recursive: true });
    for (const kind of ['YKS_BELGESI', 'TRANSKRIPT'] as const) {
      const file = placeholderPdf(`Deneme belgesi - ${kind} - ${s.studentNo}`);
      const storageKey = `${s.studentNo}/${kind.toLowerCase()}.pdf`;
      writeFileSync(join(STORAGE, storageKey), file);
      await prisma.document.create({
        data: { studentNo: s.studentNo, kind, fileName: `${kind.toLowerCase()}-${s.studentNo}.pdf`, mimeType: 'application/pdf', size: file.length, sha256: createHash('sha256').update(file).digest('hex'), storageKey },
      });
    }
  }

  // Geçen yıl kabul edilen öğrenciler: imzaları tamamlanmış protokol, iki dönemin ders kayıt formları, notlar, dönem beyanları.
  const heads = Object.fromEntries(USERS.flatMap((u) => u.assignments.filter((a) => a.role === 'BOLUM_BASKANI').map((a) => [a.programId!, u.username])));
  for (const s of STUDENTS) {
    if (!s.enrollment || !s.profile) continue;
    const o = OFFERINGS.find((x) => x.id === s.enrollment!.offeringId)!;
    const template = TEMPLATES.find((t) => (o.type === 'CAP' ? t.type === 'CAP' && t.sourceProgramId === s.profile!.programId : t.type === 'YANDAL'))!;
    const items = o.type === 'CAP' ? template.items : template.items.slice(0, 8);
    const e = await prisma.enrollment.create({
      data: { studentNo: s.studentNo, offeringId: o.id, type: o.type, startTermId: o.termId, ganoStrikes: s.enrollment.ganoStrikes, mainAdvisorUsername: s.profile.advisorUsername },
    });
    const protocol = await prisma.protocol.create({
      data: {
        enrollmentId: e.id,
        templateId: template.id,
        status: 'APPROVED',
        commonEcts: template.commonEcts,
        createdBy: COORD,
        submittedAt: new Date('2025-09-20T10:00:00+03:00'),
        approvedAt: SIGNED_AT,
        courses: {
          create: items.map((i, position) => {
            const g = s.enrollment!.grades.find((x) => x.code === i.code);
            return { position, ...i, ...(g ? { status: 'PASSED' as const, grade: g.grade, termId: g.termId } : {}) };
          }),
        },
      },
      include: { courses: true },
    });
    const who: Record<string, string | null> = {
      OGRENCI: s.studentNo,
      ANA_DAL_DANISMANI: s.profile.advisorUsername,
      ANA_DAL_BOLUM_BASKANI: heads[s.profile.programId] ?? null,
      KOORDINATOR: null,
      CAP_BOLUM_BASKANI: heads['P-BIL'],
    };
    const sign = (subjectType: 'PROTOCOL' | 'COURSE_REG', subjectId: string, roles: string[], at: Date) =>
      prisma.approval.createMany({
        data: roles.map((role) => ({ subjectType, subjectId, round: 1, role: role as 'OGRENCI', assigneeUsername: who[role], decision: 'APPROVED' as const, decidedBy: who[role] ?? COORD, decidedAt: at })),
      });
    await sign('PROTOCOL', protocol.id, ['OGRENCI', 'ANA_DAL_DANISMANI', 'ANA_DAL_BOLUM_BASKANI', 'KOORDINATOR', 'CAP_BOLUM_BASKANI'], SIGNED_AT);

    for (const [termId, codes] of Object.entries(s.enrollment.registrations)) {
      if (!codes.length) continue;
      const at = new Date(termId === 'T-2025-GUZ' ? '2025-09-28T10:00:00+03:00' : '2026-02-12T10:00:00+03:00');
      const reg = await prisma.courseRegistration.create({
        data: {
          enrollmentId: e.id,
          termId,
          status: 'APPROVED',
          createdBy: s.studentNo,
          submittedAt: at,
          approvedAt: at,
          items: { create: codes.map((code) => { const pc = protocol.courses.find((c) => c.code === code)!; return { protocolCourseId: pc.id, code, name: pc.name, ects: pc.ects }; }) },
        },
      });
      await sign('COURSE_REG', reg.id, ['OGRENCI', 'ANA_DAL_DANISMANI', 'KOORDINATOR'], at);
    }
    const entries = Object.entries(s.enrollment.termRecords);
    for (const [i, [termId, mainGano]] of entries.entries()) {
      // İrem'in son beyanı doğrulanmamış bırakılır ("doğrulanacak dönem beyanları" görevi için).
      const verified = !(s.scenario === 'iki-donem-ders-yok' && i === entries.length - 1);
      await prisma.termRecord.create({
        data: { enrollmentId: e.id, termId, mainGano, declaredBy: s.studentNo, declaredAt: new Date('2026-07-01T10:00:00+03:00'), verifiedBy: verified ? COORD : null, verifiedAt: verified ? new Date('2026-07-03T10:00:00+03:00') : null },
      });
    }
  }

  const counts = {
    bolum: await prisma.program.count(),
    ders: await prisma.course.count(),
    teklif: await prisma.offering.count(),
    sablon: await prisma.protocolTemplate.count(),
    kullanici: await prisma.user.count(),
    ogrenci: await prisma.studentProfile.count(),
    kayit: await prisma.enrollment.count(),
  };
  console.log('Seed tamam:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
