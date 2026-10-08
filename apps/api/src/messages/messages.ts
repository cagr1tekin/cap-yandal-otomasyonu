import { Body, Controller, Get, Injectable, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { DOCUMENT_KINDS, HARD_UPLOAD_LIMIT_MB, MessageSchema, NoteSchema, ReasonSchema } from '@cap/contracts';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog';
import { conflict, notFound, unprocessable, ZodPipe } from '../common/http';
import { DocumentsService } from '../documents/documents';
import type { UploadedFileLike } from '../documents/file-guard';
import { NotificationsService } from '../notifications/notifications';
import { PrismaService } from '../prisma/prisma.service';

const MessageBody = MessageSchema.extend({ attachmentKind: z.enum(DOCUMENT_KINDS).default('DIGER') });

/**
 * Koordinatör–öğrenci yazışması: her öğrenci için tek konuşma. Mesajlar kalıcıdır, silinemez ve
 * değiştirilemez (veritabanı tetikleyicisi). Ek, belge arşivine de düşer.
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly audit: AuditService,
    private readonly docs: DocumentsService,
    private readonly catalog: CatalogService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Konuşmayı döndürür; karşı tarafın okunmamış mesajlarını okundu işaretler (bölüm başkanı işaretlemez). */
  async thread(user: AuthUser, studentNo: string) {
    const s = await this.access.student(user, studentNo);
    if (user.role !== 'BOLUM_BASKANI') {
      const fromStudent = { senderId: s.userId ?? '__yok__' };
      await this.prisma.message.updateMany({
        where: { studentNo, readAt: null, ...(user.role === 'OGRENCI' ? { NOT: fromStudent } : fromStudent) },
        data: { readAt: new Date() },
      });
    }
    return this.prisma.message.findMany({
      where: { studentNo },
      include: { sender: { select: { username: true, displayName: true, role: true } }, attachments: { select: { id: true, fileName: true, kind: true, status: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async send(user: AuthUser, studentNo: string, body: string, file?: UploadedFileLike, attachmentKind: (typeof DOCUMENT_KINDS)[number] = 'DIGER') {
    const s = await this.access.writable(user, studentNo, { activeOnly: false });
    const settings = await this.catalog.settings();
    if (body.length > settings.messageMaxLength) throw unprocessable(`Mesaj en çok ${settings.messageMaxLength} karakter olabilir.`);
    if (user.role === 'OGRENCI' && !s.userId) throw conflict('Hesabınız öğrenci kartına bağlı değil.');
    // Ek denetimden geçemezse mesaj da yazılmaz.
    const msg = await this.prisma.$transaction(async (tx) => {
      const m = await tx.message.create({ data: { studentNo, senderId: user.id, body } });
      if (file?.buffer?.length) await this.docs.store(user, studentNo, { kind: attachmentKind, note: 'Mesaj eki' }, file, { messageId: m.id }, tx);
      await this.audit.log(user, { action: 'MESSAGE_SEND', entity: 'Message', entityId: m.id, studentNo, after: { length: body.length, attachment: !!file?.buffer?.length } }, tx);
      return m;
    });
    const preview = body.length > 140 ? `${body.slice(0, 140)}…` : body;
    if (user.role === 'OGRENCI') {
      await this.notifications.notifyCoordinators(`Yeni mesaj: ${s.fullName}`, preview, `/ogrenciler/${studentNo}?sekme=mesajlar`);
    } else if (s.userId) {
      const u = await this.prisma.user.findUnique({ where: { id: s.userId } });
      if (u) await this.notifications.notify(u.username, 'Koordinatörden yeni mesaj', preview, `/ogrenciler/${studentNo}?sekme=mesajlar`);
    }
    return msg;
  }

  /** Personel gelen kutusu: öğrenci başına son mesaj ve okunmamış sayısı. */
  async inbox() {
    const students = await this.prisma.student.findMany({
      where: { messages: { some: {} } },
      select: { studentNo: true, fullName: true, track: true, userId: true, messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: { role: true, displayName: true } } } } },
    });
    const unread = await this.prisma.message.groupBy({ by: ['studentNo'], where: { readAt: null, sender: { role: 'OGRENCI' } }, _count: true });
    return students
      .map((s) => ({
        studentNo: s.studentNo,
        fullName: s.fullName,
        track: s.track,
        last: s.messages[0] ? { body: s.messages[0].body.slice(0, 160), at: s.messages[0].createdAt, fromStudent: s.messages[0].sender.role === 'OGRENCI' } : null,
        unread: unread.find((u) => u.studentNo === s.studentNo)?._count ?? 0,
      }))
      .sort((a, b) => (b.last?.at.getTime() ?? 0) - (a.last?.at.getTime() ?? 0));
  }

  // ---------------- Koordinatör notları (öğrenci görmez) ----------------

  async notes(user: AuthUser, studentNo: string) {
    if (!this.access.isStaff(user)) throw notFound('Kayıt');
    await this.access.student(user, studentNo);
    return this.prisma.studentNote.findMany({ where: { studentNo }, include: { author: { select: { displayName: true, username: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async addNote(user: AuthUser, studentNo: string, body: string) {
    this.access.assertCoordinator(user);
    await this.access.student(user, studentNo);
    const n = await this.prisma.studentNote.create({ data: { studentNo, authorId: user.id, body } });
    await this.audit.log(user, { action: 'NOTE_ADD', entity: 'StudentNote', entityId: n.id, studentNo, after: { body } });
    return n;
  }

  async cancelNote(user: AuthUser, id: string, reason: string) {
    this.access.assertCoordinator(user);
    const n = await this.prisma.studentNote.findUnique({ where: { id } });
    if (!n) throw notFound('Not');
    if (n.cancelledAt) throw conflict('Not zaten iptal edilmiş.');
    await this.prisma.studentNote.update({ where: { id }, data: { cancelledAt: new Date(), cancelledBy: user.username, cancelReason: reason } });
    await this.audit.log(user, { action: 'NOTE_CANCEL', entity: 'StudentNote', entityId: id, studentNo: n.studentNo, before: { body: n.body }, reason });
    return { ok: true };
  }
}

@Controller()
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Get('messages/inbox')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  inbox() {
    return this.messages.inbox();
  }

  @Get('students/:no/messages')
  thread(@CurrentUser() user: AuthUser, @Param('no') no: string) {
    return this.messages.thread(user, no);
  }

  @Post('students/:no/messages')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: HARD_UPLOAD_LIMIT_MB * 1024 * 1024, files: 1, fields: 5 } }))
  send(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(MessageBody)) body: z.infer<typeof MessageBody>, @UploadedFile() file?: UploadedFileLike) {
    return this.messages.send(user, no, body.body, file, body.attachmentKind);
  }

  @Get('students/:no/notes')
  notes(@CurrentUser() user: AuthUser, @Param('no') no: string) {
    return this.messages.notes(user, no);
  }

  @Post('students/:no/notes')
  @Roles('KOORDINATOR')
  addNote(@CurrentUser() user: AuthUser, @Param('no') no: string, @Body(new ZodPipe(NoteSchema)) body: { body: string }) {
    return this.messages.addNote(user, no, body.body);
  }

  @Post('notes/:id/cancel')
  @Roles('KOORDINATOR')
  cancelNote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ReasonSchema)) body: { reason: string }) {
    return this.messages.cancelNote(user, id, body.reason);
  }
}
