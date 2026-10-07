import { Injectable } from '@nestjs/common';
import type {
  EnrollmentRef,
  EvaluationContext,
  OfferingSnapshot,
  StudentSnapshot,
} from '@cap/rules';
import type { Offering, OfferingSourceProgram, Program } from '@prisma/client';
import { notFound } from '../common/http';
import { ObisPort } from '../integrations/obis.port';
import { PrismaService } from '../prisma/prisma.service';

export type OfferingWithProgram = Offering & { program: Program; sourcePrograms: OfferingSourceProgram[] };

/** Kural değerlendirmesi için OBİS ve veritabanından bağlam kurar. */
@Injectable()
export class ContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly obis: ObisPort,
  ) {}

  async student(studentNo: string, fresh = false): Promise<StudentSnapshot & { fullName: string }> {
    const [standing, info] = await Promise.all([
      this.obis.getStanding(studentNo, { fresh }),
      this.obis.getStudent(studentNo),
    ]);
    const program = await this.prisma.program.findUnique({ where: { id: standing.programId } });
    if (!program) throw notFound('Öğrencinin ana dal programı');
    return {
      studentNo,
      fullName: info.fullName,
      programId: standing.programId,
      level: program.level,
      durationYears: program.durationYears,
      semesterNo: standing.semesterNo,
      gano: standing.gano,
      completedAllCoursesToDate: standing.completedAllCoursesToDate,
      classRankPercentile: standing.classRankPercentile,
      entryScore: standing.entryScore,
      yokRankRequirementMet: standing.yokRankRequirementMet,
      talentExamPassedProgramIds: standing.talentExamPassedProgramIds,
      frozen: standing.frozen,
    };
  }

  async offering(o: OfferingWithProgram, entryYear: number | null): Promise<OfferingSnapshot> {
    return {
      id: o.id,
      programId: o.programId,
      type: o.type,
      quota: o.quota,
      sourceProgramIds: o.sourcePrograms.map((s) => s.programId),
      requiresTalentExam: o.program.requiresTalentExam,
      requiresSuccessRank: o.program.requiresSuccessRank,
      programBaseScore: entryYear ? await this.obis.getProgramBaseScore(o.programId, entryYear) : null,
      programCategory: o.program.category,
      firstYearIntake: o.firstYearIntake,
    };
  }

  /** Sistem içi kayıtlar (OBİS'te değil, bu sistemde tutulur). */
  async enrollments(studentNo: string): Promise<{ refs: EnrollmentRef[]; removedMinorProgramIds: string[] }> {
    const rows = await this.prisma.enrollment.findMany({ where: { studentNo } });
    return {
      refs: rows.map((e) => ({ offeringId: e.offeringId, programId: e.programId, type: e.type, status: e.status })),
      removedMinorProgramIds: rows.filter((e) => e.type === 'YANDAL' && e.status === 'REMOVED').map((e) => e.programId),
    };
  }

  /** Başvuru aşaması bağlamı. Saklanan anlık görüntü de budur (yeniden üretilebilirlik için). */
  async application(
    studentNo: string,
    o: OfferingWithProgram,
    opts: { fresh?: boolean; osymVerified?: boolean; student?: StudentSnapshot & { fullName: string } } = {},
  ): Promise<{ ctx: EvaluationContext; fullName: string }> {
    const student = opts.student ?? (await this.student(studentNo, opts.fresh));
    const { fullName, ...snapshot } = student;
    const [offering, enr] = await Promise.all([
      this.offering(o, student.entryScore?.year ?? null),
      this.enrollments(studentNo),
    ]);
    return {
      fullName,
      ctx: {
        student: snapshot,
        offering,
        enrollments: enr.refs,
        previouslyRemovedProgramIds: enr.removedMinorProgramIds,
        osymVerified: opts.osymVerified ?? false,
      },
    };
  }
}
