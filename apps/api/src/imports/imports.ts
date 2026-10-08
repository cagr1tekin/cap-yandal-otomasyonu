import { Body, Controller, Get, Injectable, Post } from '@nestjs/common';
import { ImportRowSchemas, ImportSchema, type ImportKind } from '@cap/contracts';
import type { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog';
import { Problem, ZodPipe } from '../common/http';
import { CurriculumService } from '../curriculum/curriculum.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChecksService } from '../rules/checks.service';
import { StudentsService } from '../students/students';

interface RowResult {
  row: number;
  key: string;
  action: 'EKLE' | 'GUNCELLE' | 'ATLA' | 'HATA';
  message: string;
}

/**
 * Dışarıdan veri aktarımı (CSV satırları). Her satır, elle girişin kullandığı servis yöntemlerinden geçer;
 * böylece doğrulama, onay ve işlem kaydı aynıdır. İleride OBİS bağlantısı bu servisi kaynak olarak kullanır.
 * Önce deneme (commit=false) ile satır satır ne olacağı gösterilir; hiçbir şey yazılmaz.
 */
@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
    private readonly students: StudentsService,
    private readonly curriculum: CurriculumService,
    private readonly checks: ChecksService,
  ) {}

  private message(e: unknown) {
    if (e instanceof Problem) return String((e.getResponse() as { detail?: string }).detail ?? e.message);
    return (e as Error).message;
  }

  async run(user: AuthUser, input: z.infer<typeof ImportSchema>) {
    const results: RowResult[] = [];
    const touched = new Set<string>();
    for (const [i, raw] of input.rows.entries()) {
      const row = i + 2; // başlık satırından sonra
      const parsed = ImportRowSchemas[input.kind].safeParse(raw);
      if (!parsed.success) {
        results.push({ row, key: Object.values(raw)[0] ?? '', action: 'HATA', message: parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') });
        continue;
      }
      try {
        results.push(await this.row(user, input.kind, row, parsed.data as never, input.commit, touched));
      } catch (e) {
        results.push({ row, key: Object.values(raw)[0] ?? '', action: 'HATA', message: this.message(e) });
      }
    }
    if (input.commit) {
      for (const no of touched) await this.checks.run(no, 'AKTARIM', user);
      const ok = results.filter((r) => r.action === 'EKLE' || r.action === 'GUNCELLE').length;
      const batch = await this.prisma.importBatch.create({ data: { kind: input.kind, rowCount: input.rows.length, okCount: ok, summary: results as unknown as object, createdBy: user.username } });
      await this.audit.log(user, { action: 'IMPORT', entity: 'ImportBatch', entityId: batch.id, after: { kind: input.kind, rows: input.rows.length, ok } });
    }
    return { commit: input.commit, results, ok: results.filter((r) => r.action === 'EKLE' || r.action === 'GUNCELLE').length, errors: results.filter((r) => r.action === 'HATA').length };
  }

  private async row(user: AuthUser, kind: ImportKind, row: number, data: Record<string, unknown>, commit: boolean, touched: Set<string>): Promise<RowResult> {
    if (kind === 'COURSES') {
      const d = data as z.infer<typeof ImportRowSchemas.COURSES>;
      const exists = await this.prisma.course.findUnique({ where: { code: d.code } });
      if (commit) {
        if (exists) await this.catalog.updateCourse(d.code, { name: d.name, ects: d.ects, credit: d.credit, semester: d.semester, kind: d.kind, reason: 'Dışarıdan aktarım' }, user);
        else await this.catalog.createCourse(d, user);
      }
      return { row, key: d.code, action: exists ? 'GUNCELLE' : 'EKLE', message: `${d.code} ${d.name}` };
    }

    if (kind === 'STUDENTS') {
      const d = data as z.infer<typeof ImportRowSchemas.STUDENTS>;
      if (await this.prisma.student.findUnique({ where: { studentNo: d.studentNo } })) return { row, key: d.studentNo, action: 'ATLA', message: 'Öğrenci zaten kayıtlı' };
      await this.catalog.term(d.admissionTermId);
      if (d.mainProgramId && !(await this.prisma.program.findUnique({ where: { id: d.mainProgramId } }))) throw new Error(`Bölüm bulunamadı: ${d.mainProgramId}`);
      if (commit) await this.students.create(user, { ...d, sendInvite: false, commonEcts: d.commonEcts ?? 0 }, 'IMPORT');
      return { row, key: d.studentNo, action: 'EKLE', message: `${d.fullName} (${d.track}); hesap açılır, davet sonra gönderilir` };
    }

    const d = data as z.infer<typeof ImportRowSchemas.ATTEMPTS>;
    if (!(await this.prisma.student.findUnique({ where: { studentNo: d.studentNo } }))) throw new Error('Öğrenci kayıtlı değil');
    await this.catalog.course(d.courseCode);
    await this.catalog.term(d.termId);
    let item = await this.prisma.planItem.findFirst({ where: { studentNo: d.studentNo, courseCode: d.courseCode, removedAt: null, status: 'APPROVED' }, include: { attempts: true } });
    if (item?.attempts.some((a) => a.termId === d.termId && ['PENDING', 'APPROVED'].includes(a.status))) return { row, key: `${d.studentNo} ${d.courseCode}`, action: 'ATLA', message: 'Bu dönem kaydı zaten var' };
    if (commit) {
      if (!item) {
        const created = await this.curriculum.addPlanItem(user, d.studentNo, { courseCode: d.courseCode, reason: 'Dışarıdan aktarım' }, 'IMPORT');
        item = { ...created, attempts: [] };
      }
      await this.curriculum.backfill(user, d.studentNo, { planItemId: item.id, termId: d.termId, grade: d.grade, note: 'Dışarıdan aktarım' }, 'IMPORT', undefined, false);
      touched.add(d.studentNo);
    }
    return { row, key: `${d.studentNo} ${d.courseCode}`, action: 'EKLE', message: `${d.termId}${d.grade ? ` · ${d.grade}` : ''}${item ? '' : ' (ders listeye de eklenir)'}` };
  }

  batches() {
    return this.prisma.importBatch.findMany({ orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, kind: true, rowCount: true, okCount: true, createdBy: true, createdAt: true } });
  }
}

@Controller('imports')
@Roles('KOORDINATOR')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post()
  run(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ImportSchema)) body: z.infer<typeof ImportSchema>) {
    return this.imports.run(user, body);
  }

  @Get()
  batches() {
    return this.imports.batches();
  }
}
