import { Injectable } from '@nestjs/common';
import type { EnrollmentRef, EvaluationContext, OfferingSnapshot, StudentSnapshot } from '@cap/rules';
import type { Offering, OfferingSourceProgram, StudentProfile } from '@prisma/client';
import { AccessService } from '../auth/access.service';
import { PrismaService } from '../prisma/prisma.service';

export type OfferingWithSources = Offering & { sourcePrograms: OfferingSourceProgram[] };

/** Sınıf sırası ve mevcudundan başarı yüzdeliği: 5/82 → 6,1 (en üst %6,1). */
export function rankPercentile(rank: number | null, size: number | null): number | null {
  if (!rank || !size) return null;
  return Math.round((rank / size) * 1000) / 10;
}

/**
 * Kural değerlendirmesi için bağlam kurar. Öğrenci verisinin kaynağı öğrencinin kendi girdiği
 * bilgilerdir (StudentProfile); OBİS bağlantısı yoktur (docs/KARARLAR.md K-12).
 */
@Injectable()
export class ContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async student(p: StudentProfile, frozen = false): Promise<StudentSnapshot> {
    const stat = await this.prisma.yearStat.findUnique({ where: { year: p.entryYear } });
    return {
      studentNo: p.studentNo,
      programId: p.programId,
      // Kapsamdaki bütün bölümler dört yıllık lisans programıdır.
      level: 'LISANS',
      durationYears: 4,
      semesterNo: p.semesterNo,
      gano: p.gano,
      completedAllCoursesToDate: p.completedAllCourses,
      classRankPercentile: rankPercentile(p.classRank, p.classSize),
      entryScore: p.entryScore !== null ? { year: p.entryYear, score: p.entryScore } : null,
      yokRankRequirementMet: stat?.successRankLimit ? p.successRank !== null && p.successRank <= stat.successRankLimit : null,
      talentExamPassedProgramIds: [],
      frozen,
    };
  }

  async offering(o: OfferingWithSources, entryYear: number | null): Promise<OfferingSnapshot> {
    const [home, stat] = await Promise.all([
      this.access.home(),
      entryYear ? this.prisma.yearStat.findUnique({ where: { year: entryYear } }) : null,
    ]);
    return {
      id: o.id,
      programId: home.id,
      type: o.type,
      quota: o.quota,
      sourceProgramIds: o.sourcePrograms.map((s) => s.programId),
      requiresTalentExam: false,
      requiresSuccessRank: !!stat?.successRankLimit,
      programBaseScore: stat?.baseScore ?? null,
      programCategory: 'MUHENDISLIK',
      firstYearIntake: o.firstYearIntake,
    };
  }

  async enrollments(studentNo: string): Promise<{ refs: EnrollmentRef[]; removedMinorProgramIds: string[] }> {
    const [rows, home] = await Promise.all([this.prisma.enrollment.findMany({ where: { studentNo } }), this.access.home()]);
    return {
      refs: rows.map((e) => ({ offeringId: e.offeringId, programId: home.id, type: e.type, status: e.status })),
      removedMinorProgramIds: rows.some((e) => e.type === 'YANDAL' && e.status === 'REMOVED') ? [home.id] : [],
    };
  }

  /** Başvuru aşaması bağlamı. Saklanan anlık görüntü de budur (yeniden üretilebilirlik için). */
  async application(p: StudentProfile, o: OfferingWithSources, verified: boolean): Promise<EvaluationContext> {
    const [student, offering, enr] = await Promise.all([this.student(p), this.offering(o, p.entryYear), this.enrollments(p.studentNo)]);
    return {
      student,
      offering,
      enrollments: enr.refs,
      previouslyRemovedProgramIds: enr.removedMinorProgramIds,
      // Taban puan yolunda YKS belgesinin koordinatörce doğrulanması beklenir (KR-ÇAP-03b).
      osymVerified: verified,
    };
  }
}
