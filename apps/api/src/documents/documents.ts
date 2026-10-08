import { Body, Controller, Get, Inject, Injectable, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { DocumentMetaSchema, DocumentRequestSchema, HARD_UPLOAD_LIMIT_MB, LABELS, ReasonSchema, STAFF_ONLY_DOCUMENTS, TERM_DOCUMENTS } from '@cap/contracts';
import type { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import type { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog';
import { badRequest, conflict, notFound, unprocessable, ZodPipe } from '../common/http';
import { APP_CONFIG, type AppConfig } from '../config';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';
import { checkFile, type UploadedFileLike } from './file-guard';

type Tx = Prisma.TransactionClient | PrismaService;
type Meta = z.infer<typeof DocumentMetaSchema>;

/**
 * Belge arşivi. Öğrenci yalnızca kendi kartına yükler ve yalnızca kendi belgelerini görür; belge silinemez.
 * Reddedilen ya da yenilenen belgenin eski sürümü arşivde kalır (sürüm zinciri).
 */
@Injectable()
export class DocumentsService {
  private readonly root: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.root = resolve(config.UPLOAD_DIR);
  }

  private path(storageKey: string) {
    const p = resolve(this.root, storageKey);
    // Dosya yolu her zaman depo dizininin içinde kalmalı.
    if (!p.startsWith(this.root + sep)) throw badRequest('Geçersiz dosya yolu.');
    return p;
  }

  /** Dosyayı denetler, diske yazar ve kaydını oluşturur. Mesaj ekleri de buradan geçer. */
  async store(user: AuthUser, studentNo: string, meta: Meta, file: UploadedFileLike | undefined, extra: { messageId?: string } = {}, tx: Tx = this.prisma) {
    const student = await this.access.writable(user, studentNo, { activeOnly: false });
    if (user.role === 'OGRENCI' && STAFF_ONLY_DOCUMENTS.includes(meta.kind)) throw unprocessable(`${LABELS.document[meta.kind]} türünü yalnızca koordinatör yükler.`);
    if (TERM_DOCUMENTS.includes(meta.kind) && !meta.termId) throw unprocessable(`${LABELS.document[meta.kind]} için dönem seçin.`);
    if (meta.termId) await this.catalog.term(meta.termId);

    if (meta.replacesId) {
      const prev = await tx.document.findUnique({ where: { id: meta.replacesId }, include: { next: true } });
      if (!prev || prev.studentNo !== studentNo) throw notFound('Yenilenecek belge');
      if (prev.next) throw conflict('Bu belgenin daha yeni bir sürümü var; en son sürümü yenileyin.');
      if (prev.kind !== meta.kind) throw unprocessable('Yeni sürüm aynı belge türünde olmalı.');
    }
    if (meta.requestId) {
      const req = await tx.documentRequest.findUnique({ where: { id: meta.requestId } });
      if (!req || req.studentNo !== studentNo) throw notFound('Belge isteği');
      if (!['OPEN', 'REJECTED'].includes(req.status)) throw conflict('Bu isteğe yanıt beklenmiyor.');
    }

    const settings = await this.catalog.settings();
    const checked = checkFile(file, { maxMb: settings.uploadMaxMb, types: settings.uploadTypes });
    const storageKey = `${student.studentNo}/${randomUUID()}.${checked.extension}`;
    await mkdir(join(this.root, student.studentNo), { recursive: true });
    await writeFile(this.path(storageKey), file!.buffer, { flag: 'wx' });

    const staff = user.role === 'KOORDINATOR';
    const doc = await tx.document.create({
      data: {
        studentNo,
        kind: meta.kind,
        termId: meta.termId ?? null,
        fileName: checked.fileName,
        mimeType: checked.mimeType,
        size: file!.buffer.length,
        sha256: createHash('sha256').update(file!.buffer).digest('hex'),
        storageKey,
        note: meta.note ?? null,
        status: staff ? 'APPROVED' : 'PENDING',
        uploadedBy: user.username,
        ...(staff ? { reviewedBy: user.username, reviewedAt: new Date() } : {}),
        previousId: meta.replacesId ?? null,
        requestId: meta.requestId ?? null,
        messageId: extra.messageId ?? null,
      },
    });
    if (meta.requestId) await tx.documentRequest.update({ where: { id: meta.requestId }, data: { status: staff ? 'APPROVED' : 'UPLOADED', closedAt: staff ? new Date() : null } });
    await this.audit.log(user, { action: 'DOCUMENT_UPLOAD', entity: 'Document', entityId: doc.id, studentNo, after: { kind: doc.kind, termId: doc.termId, fileName: doc.fileName, size: doc.size, sha256: doc.sha256, replacesId: meta.replacesId, requestId: meta.requestId } }, tx);
    if (!staff && !extra.messageId) {
      await this.notifications.notifyCoordinators('Onay bekleyen belge', `${studentNo}: ${LABELS.document[doc.kind]} yüklendi (${doc.fileName}).`, `/ogrenciler/${studentNo}?sekme=belgeler`);
    }
    return doc;
  }

  list(studentNo: string) {
    return this.prisma.document.findMany({
      where: { studentNo },
      include: { term: true, request: { select: { id: true, message: true } } },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async review(user: AuthUser, id: string, decision: 'APPROVED' | 'REJECTED', note?: string) {
    this.access.assertCoordinator(user);
    const d = await this.prisma.document.findUnique({ where: { id }, include: { student: { include: { user: true } } } });
    if (!d) throw notFound('Belge');
    if (d.status !== 'PENDING') throw conflict('Bu belge için zaten karar verildi.');
    await this.prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id }, data: { status: decision, reviewedBy: user.username, reviewedAt: new Date(), reviewNote: note ?? null } });
      if (d.requestId) await tx.documentRequest.update({ where: { id: d.requestId }, data: { status: decision, closedAt: decision === 'APPROVED' ? new Date() : null } });
      await this.audit.log(user, { action: `DOCUMENT_${decision}`, entity: 'Document', entityId: id, studentNo: d.studentNo, before: { status: d.status }, after: { status: decision }, reason: note }, tx);
    });
    if (d.student.user) {
      await this.notifications.notify(
        d.student.user.username,
        decision === 'APPROVED' ? 'Belgeniz onaylandı' : 'Belgeniz reddedildi',
        decision === 'APPROVED' ? `${LABELS.document[d.kind]} (${d.fileName}) onaylandı.` : `${LABELS.document[d.kind]} (${d.fileName}) reddedildi: ${note}. Yeni sürümünü yükleyebilirsiniz.`,
        `/ogrenciler/${d.studentNo}?sekme=belgeler`,
      );
    }
    return { ok: true, studentNo: d.studentNo, label: `${LABELS.document[d.kind]} (${d.fileName})` };
  }

  async cancel(user: AuthUser, id: string, reason: string) {
    this.access.assertCoordinator(user);
    const d = await this.prisma.document.findUnique({ where: { id } });
    if (!d) throw notFound('Belge');
    if (d.status === 'CANCELLED') throw conflict('Belge zaten iptal edilmiş.');
    await this.prisma.document.update({ where: { id }, data: { status: 'CANCELLED', reviewedBy: user.username, reviewedAt: new Date(), reviewNote: reason } });
    await this.audit.log(user, { action: 'DOCUMENT_CANCEL', entity: 'Document', entityId: id, studentNo: d.studentNo, before: { status: d.status }, reason });
    return { ok: true };
  }

  async file(user: AuthUser, id: string) {
    const d = await this.prisma.document.findUnique({ where: { id } });
    if (!d) throw notFound('Belge');
    await this.access.student(user, d.studentNo);
    const body = await readFile(this.path(d.storageKey)).catch(() => null);
    if (!body) throw notFound('Belge dosyası');
    if (user.studentNo !== d.studentNo) await this.audit.log(user, { action: 'DOCUMENT_VIEW', entity: 'Document', entityId: id, studentNo: d.studentNo });
    return { doc: d, body };
  }

  // ---------------- Belge istekleri ----------------

  async createRequest(user: AuthUser, studentNo: string, input: z.infer<typeof DocumentRequestSchema>) {
    this.access.assertCoordinator(user);
    const s = await this.access.student(user, studentNo);
    if (input.termId) await this.catalog.term(input.termId);
    const r = await this.prisma.documentRequest.create({ data: { studentNo, kind: input.kind, termId: input.termId ?? null, message: input.message, dueDate: input.dueDate ?? null, createdBy: user.username } });
    await this.audit.log(user, { action: 'DOC_REQUEST_CREATE', entity: 'DocumentRequest', entityId: r.id, studentNo, after: input });
    const u = s.userId ? await this.prisma.user.findUnique({ where: { id: s.userId } }) : null;
    if (u) await this.notifications.notify(u.username, 'Koordinatör belge istiyor', `${LABELS.document[input.kind]}: ${input.message}`, `/ogrenciler/${studentNo}?sekme=belgeler`);
    return r;
  }

  async cancelRequest(user: AuthUser, id: string, reason: string) {
    this.access.assertCoordinator(user);
    const r = await this.prisma.documentRequest.findUnique({ where: { id } });
    if (!r) throw notFound('Belge isteği');
    if (['APPROVED', 'CANCELLED'].includes(r.status)) throw conflict('Kapanmış istek iptal edilmez.');
    await this.prisma.documentRequest.update({ where: { id }, data: { status: 'CANCELLED', closedAt: new Date() } });
    await this.audit.log(user, { action: 'DOC_REQUEST_CANCEL', entity: 'DocumentRequest', entityId: id, studentNo: r.studentNo, reason });
    return { ok: true };
  }

  requests(studentNo: string) {
    return this.prisma.documentRequest.findMany({ where: { studentNo }, include: { documents: { select: { id: true, fileName: true, status: true, uploadedAt: true } } }, orderBy: { createdAt: 'desc' } });
  }
}

const UPLOAD = FileInterceptor('file', { limits: { fileSize: HARD_UPLOAD_LIMIT_MB * 1024 * 1024, files: 1, fields: 10 } });

@Controller()
export class DocumentsController {
  constructor(
    private readonly docs: DocumentsService,
    private readonly access: AccessService,
  ) {}

  @Get('students/:no/documents')
  async list(@CurrentUser() user: AuthUser, @Param('no') no: string) {
    await this.access.student(user, no);
    const [documents, requests] = await Promise.all([this.docs.list(no), this.docs.requests(no)]);
    return { documents, requests };
  }

  @Post('students/:no/documents')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(UPLOAD)
  upload(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(DocumentMetaSchema)) body: Meta, @UploadedFile() file: UploadedFileLike) {
    return this.docs.store(user, no, body, file);
  }

  @Post('documents/:id/cancel')
  @Roles('KOORDINATOR')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ReasonSchema)) body: { reason: string }) {
    return this.docs.cancel(user, id, body.reason);
  }

  @Get('documents/:id/file')
  async file(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { doc, body } = await this.docs.file(user, id);
    res
      .setHeader('content-type', doc.mimeType)
      .setHeader('x-content-type-options', 'nosniff')
      .setHeader('content-security-policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'")
      .setHeader('cache-control', 'private, no-store')
      .setHeader('content-disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`)
      .send(body);
  }

  @Post('students/:no/document-requests')
  @Roles('KOORDINATOR')
  request(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(DocumentRequestSchema)) body: z.infer<typeof DocumentRequestSchema>) {
    return this.docs.createRequest(user, no, body);
  }

  @Post('document-requests/:id/cancel')
  @Roles('KOORDINATOR')
  cancelRequest(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ReasonSchema)) body: { reason: string }) {
    return this.docs.cancelRequest(user, id, body.reason);
  }
}
