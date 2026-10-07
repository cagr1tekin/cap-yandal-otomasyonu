/**
 * Geliştirme verisi. Her çalıştırmada tabloları boşaltıp yeniden doldurur.
 * Kaynak: @cap/seed-data (sahte OBİS ve Keycloak ile aynı veri) + @cap/rules varsayılan kural setleri.
 */
import { PrismaClient } from '@prisma/client';
import { DEFAULT_RULE_SETS } from '@cap/rules';
import {
  COURSES,
  CURRENT_TERM_ID,
  EXISTING_ENROLLMENTS,
  OFFERINGS,
  PROGRAMS,
  TERMS,
  UNITS,
  USERS,
  coordinatorUsername,
} from '@cap/seed-data';

const prisma = new PrismaClient();

async function main() {
  const tables = [
    'AuditLog', 'Notification', 'WithdrawalRequest', 'ScanFinding', '_RuleSetToTermScan', 'TermScan',
    'MinorPlanItem', 'Enrollment', 'BoardDecision', 'Ranking', 'Application', 'RuleDefinition', 'RuleSet',
    'ApplicationWindow', 'MinorPoolCourse', 'OfferingSourceProgram', 'Offering', 'Term', 'Program', 'Unit',
    'RoleAssignment', 'User',
  ];
  // TRUNCATE satır tetikleyicilerini çalıştırmaz; denetim kaydı yalnızca seed ile sıfırlanabilir.
  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);

  await prisma.unit.createMany({ data: UNITS.map((u) => ({ id: u.id, code: u.code, name: u.name, kind: u.kind })) });
  await prisma.program.createMany({
    data: PROGRAMS.map((p) => ({
      id: p.id,
      unitId: p.unitId,
      obisProgramId: p.id,
      name: p.name,
      level: p.level,
      durationYears: p.durationYears,
      category: p.category,
      requiresTalentExam: p.requiresTalentExam ?? false,
      requiresSuccessRank: p.requiresSuccessRank ?? false,
    })),
  });
  await prisma.term.createMany({
    data: TERMS.map((t) => ({
      id: t.id,
      year: t.year,
      season: t.season,
      startsAt: new Date(`${t.startsAt}T00:00:00+03:00`),
      endsAt: new Date(`${t.endsAt}T23:59:59+03:00`),
      isCurrent: t.id === CURRENT_TERM_ID,
    })),
  });

  for (const o of OFFERINGS) {
    const prog = PROGRAMS.find((p) => p.id === o.programId)!;
    await prisma.offering.create({
      data: {
        id: o.id,
        programId: o.programId,
        termId: o.termId,
        type: o.type,
        quota: o.quota,
        coordinatorUsername: coordinatorUsername(o.programId),
        firstYearIntake: prog.firstYearIntake,
        status: o.termId === CURRENT_TERM_ID ? 'PUBLISHED' : 'CLOSED',
        rankingLockedAt: o.termId === CURRENT_TERM_ID ? null : new Date('2025-09-01T12:00:00+03:00'),
        sourcePrograms: { create: o.sourceProgramIds.map((programId) => ({ programId })) },
        poolCourses: {
          create: (o.pool ?? []).map((code) => {
            const c = COURSES.find((x) => x.code === code)!;
            return { courseCode: c.code, name: c.name, ects: c.ects };
          }),
        },
      },
    });
  }

  // Başvuru takvimi: geçmiş dönem kapalı; içinde bulunulan dönem gösterim için açık.
  for (const u of UNITS) {
    for (const type of ['CAP', 'YANDAL'] as const) {
      await prisma.applicationWindow.create({
        data: {
          unitId: u.id,
          termId: 'T-2025-GUZ',
          type,
          opensAt: new Date('2025-08-01T09:00:00+03:00'),
          closesAt: new Date('2025-08-15T17:00:00+03:00'),
          announceAt: new Date('2025-09-01T09:00:00+03:00'),
        },
      });
      await prisma.applicationWindow.create({
        data: {
          unitId: u.id,
          termId: CURRENT_TERM_ID,
          type,
          opensAt: new Date('2026-09-01T09:00:00+03:00'),
          closesAt: new Date('2026-12-31T17:00:00+03:00'),
          announceAt: new Date('2027-01-05T09:00:00+03:00'),
        },
      });
    }
  }

  for (const set of DEFAULT_RULE_SETS) {
    await prisma.ruleSet.create({
      data: {
        version: set.version,
        type: set.type,
        effectiveFrom: new Date(set.effectiveFrom),
        status: 'ACTIVE',
        note: 'Varsayılan kural seti (PRD bölüm 5)',
        createdBy: 'seed',
        rules: {
          create: set.rules.map((r, i) => ({
            code: r.code,
            kind: r.kind,
            article: r.article,
            title: r.title,
            phase: r.phase,
            params: r.params as object,
            position: i,
          })),
        },
      },
    });
  }

  for (const u of USERS) {
    await prisma.user.create({
      data: {
        username: u.username,
        displayName: u.displayName,
        email: u.email,
        assignments: {
          create: u.assignments.map((a) => ({ role: a.role, unitId: a.unitId, programId: a.programId })),
        },
      },
    });
  }

  for (const e of EXISTING_ENROLLMENTS) {
    const o = OFFERINGS.find((x) => x.id === e.offeringId)!;
    await prisma.enrollment.create({
      data: {
        studentNo: e.studentNo,
        offeringId: o.id,
        type: o.type,
        programId: o.programId,
        startTermId: o.termId,
        ganoStrikes: e.ganoStrikes,
      },
    });
  }

  const counts = {
    birim: await prisma.unit.count(),
    program: await prisma.program.count(),
    teklif: await prisma.offering.count(),
    kullanici: await prisma.user.count(),
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
