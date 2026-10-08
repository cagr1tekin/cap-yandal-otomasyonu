import { Body, Controller, Delete, Get, Inject, Injectable, Param, Post, Put, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DOCUMENT_KINDS, StudentProfileSchema, UPLOAD_MAX_BYTES, UPLOAD_MIME, type DocumentKind, type StudentProfileInput } from '@cap/contracts';
import type { Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { badRequest, conflict, forbidden, notFound, unprocessable, ZodPipe } from '../common/http';
import { APP_CONFIG, type AppConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { rankPercentile } from '../rules/context.service';

interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const EXT: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

/** Dosya içeriği bildirilen türle uyuşuyor mu (uzantıya güvenilmez). */
function sniff(buffer: Buffer): string | null {
  if (buffer.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  return null;
}

@Injectable()
export class StudentsService {
  private readonly root: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.root = resolve(config.UPLOAD_DIR);
  }

  /** Öğrencinin seçebileceği ana dal bölümleri ve o bölümlerin danışman hesapları. */
  async options() {
    const [programs, advisors] = await Promise.all([
      this.prisma.program.findMany({ where: { isHome: false }, orderBy: { name: 'asc' } }),
      this.prisma.roleAssignment.findMany({ where: { role: 'DANISMAN', programId: { not: null } }, include: { user: true } }),
    ]);
    return {
      programs,
      advisors: advisors.map((a) => ({ username: a.user.username, displayName: a.user.displayName, programId: a.programId! })),
    };
  }

  async mine(user: AuthUser) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: await this.userId(user) },
      include: { program: true, documents: { orderBy: { uploadedAt: 'desc' }, include: { _count: { select: { applications: true } } } } },
    });
    return {
      account: { username: user.username, displayName: user.displayName, email: user.email },
      profile: profile ? { ...profile, classRankPercentile: rankPercentile(profile.classRank, profile.classSize) } : null,
      ...(await this.options()),
    };
  }

  private async userId(user: AuthUser) {
    return (await this.prisma.user.findUniqueOrThrow({ where: { username: user.username }, select: { id: true } })).id;
  }

  /** Öğrenci bilgilerini kendisi girer ve günceller. Verilmiş başvurular, verildikleri andaki beyanı saklar. */
  async save(user: AuthUser, input: StudentProfileInput, ip?: string) {
    if (!this.access.isStudent(user)) throw forbidden('Öğrenci bilgileri yalnızca öğrenci hesabıyla girilir.');
    const userId = await this.userId(user);
    const existing = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (existing && existing.studentNo !== input.studentNo) {
      throw conflict('Öğrenci numarası kaydedildikten sonra değiştirilemez. Hatalıysa ÇAP / yan dal koordinatörüne başvurun.');
    }
    const taken = await this.prisma.studentProfile.findUnique({ where: { studentNo: input.studentNo } });
    if (taken && taken.userId !== userId) throw conflict('Bu öğrenci numarası başka bir hesaba kayıtlı.');

    const program = await this.prisma.program.findUnique({ where: { id: input.programId } });
    if (!program || program.isHome) throw unprocessable('Ana dal bölümü geçersiz. Bilgisayar Mühendisliği öğrencileri kendi bölümüne başvuramaz.');
    if (input.advisorUsername) {
      const ok = await this.prisma.roleAssignment.findFirst({ where: { role: 'DANISMAN', programId: program.id, user: { username: input.advisorUsername } } });
      if (!ok) throw unprocessable('Seçilen danışman bu bölümün danışmanı değil.');
    }

    const data = {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone || null,
      programId: input.programId,
      entryYear: input.entryYear,
      semesterNo: input.semesterNo,
      gano: input.gano,
      completedAllCourses: input.completedAllCourses,
      classRank: input.classRank,
      classSize: input.classSize,
      entryScore: input.entryScore,
      successRank: input.successRank,
      advisorUsername: input.advisorUsername || null,
    };
    const saved = await this.prisma.$transaction(async (tx) => {
      const p = existing
        ? await tx.studentProfile.update({ where: { userId }, data })
        : await tx.studentProfile.create({ data: { ...data, studentNo: input.studentNo, userId } });
      await tx.user.update({ where: { id: userId }, data: { displayName: input.fullName, email: input.email } });
      await this.audit.log(
        {
          actor: user.username,
          action: existing ? 'PROFILE_UPDATE' : 'PROFILE_CREATE',
          entity: 'StudentProfile',
          entityId: p.studentNo,
          before: existing ? { gano: existing.gano, semesterNo: existing.semesterNo, classRank: existing.classRank, classSize: existing.classSize, entryScore: existing.entryScore, successRank: existing.successRank } : undefined,
          after: { gano: p.gano, semesterNo: p.semesterNo, classRank: p.classRank, classSize: p.classSize, entryScore: p.entryScore, successRank: p.successRank, programId: p.programId },
          ip,
        },
        tx,
      );
      return p;
    });
    return saved;
  }

  async upload(user: AuthUser, kind: DocumentKind, file: UploadedFileLike | undefined) {
    if (!user.studentNo) throw conflict('Belge yüklemeden önce bilgilerinizi kaydedin.');
    if (!file?.buffer?.length) throw badRequest('Dosya seçilmedi.');
    if (file.size > UPLOAD_MAX_BYTES) throw badRequest('Dosya 5 MB sınırını aşıyor.');
    const type = sniff(file.buffer);
    if (!type || !(UPLOAD_MIME as readonly string[]).includes(type)) throw badRequest('Yalnızca PDF, JPG ya da PNG yüklenebilir.');

    const storageKey = `${user.studentNo}/${randomUUID()}.${EXT[type]}`;
    await mkdir(join(this.root, user.studentNo), { recursive: true });
    await writeFile(join(this.root, storageKey), file.buffer);
    const doc = await this.prisma.document.create({
      data: {
        studentNo: user.studentNo,
        kind,
        // multer dosya adını latin1 olarak verir; Türkçe karakterler için UTF-8'e çevrilir.
        fileName: Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 200),
        mimeType: type,
        size: file.size,
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
        storageKey,
      },
    });
    await this.audit.log({ actor: user.username, action: 'DOCUMENT_UPLOAD', entity: 'Document', entityId: doc.id, after: { kind, fileName: doc.fileName, size: doc.size, sha256: doc.sha256 } });
    return doc;
  }

  async remove(user: AuthUser, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id }, include: { _count: { select: { applications: true } } } });
    if (!doc || doc.studentNo !== user.studentNo) throw notFound('Belge');
    if (doc._count.applications) throw conflict('Bir başvuruya eklenmiş belge silinemez.');
    await this.prisma.document.delete({ where: { id } });
    await unlink(join(this.root, doc.storageKey)).catch(() => undefined);
    await this.audit.log({ actor: user.username, action: 'DOCUMENT_DELETE', entity: 'Document', entityId: id, before: { kind: doc.kind, fileName: doc.fileName } });
    return { ok: true };
  }

  async download(user: AuthUser, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id }, include: { student: true } });
    if (!doc) throw notFound('Belge');
    if (!(await this.access.canSeeStudent(user, doc.student))) throw forbidden('Bu belgeye erişim yetkiniz yok.');
    const body = await readFile(join(this.root, doc.storageKey)).catch(() => null);
    if (!body) throw notFound('Belge dosyası');
    if (user.studentNo !== doc.studentNo) {
      await this.audit.log({ actor: user.username, action: 'DOCUMENT_VIEW', entity: 'Document', entityId: id });
    }
    return { doc, body };
  }
}

@Controller()
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get('me/profile')
  @Roles('OGRENCI')
  mine(@CurrentUser() user: AuthUser) {
    return this.students.mine(user);
  }

  @Put('me/profile')
  @Roles('OGRENCI')
  save(@CurrentUser() user: AuthUser, @Body(new ZodPipe(StudentProfileSchema)) body: StudentProfileInput) {
    return this.students.save(user, body);
  }

  @Post('me/documents')
  @Roles('OGRENCI')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 } }))
  upload(@CurrentUser() user: AuthUser, @Body('kind') kind: string, @UploadedFile() file: UploadedFileLike) {
    return this.students.upload(user, z.enum(DOCUMENT_KINDS).parse(kind), file);
  }

  @Delete('me/documents/:id')
  @Roles('OGRENCI')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.students.remove(user, id);
  }

  @Get('documents/:id')
  async download(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { doc, body } = await this.students.download(user, id);
    res
      .setHeader('content-type', doc.mimeType)
      .setHeader('x-content-type-options', 'nosniff')
      .setHeader('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`)
      .send(body);
  }
}
