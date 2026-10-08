import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Controller, Get, Injectable, Logger, Param, Post } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { CurrentUser, ReadOnlySafe, type AuthUser } from '../auth/auth';
import { notFound } from '../common/http';
import { MailPort } from '../integrations/integrations.module';
import { PrismaService } from '../prisma/prisma.service';

export const MAIL_QUEUE = 'mail';

interface MailJob {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(MAIL_QUEUE) private readonly mail: Queue<MailJob>,
  ) {}

  /** Sistem içi bildirim (zorunlu) + e-posta (kullanıcının adresi varsa). */
  async notify(username: string, title: string, body: string, link?: string) {
    await this.prisma.notification.create({ data: { username, title, body, link } });
    const user = await this.prisma.user.findUnique({ where: { username }, select: { email: true } });
    if (user?.email) {
      try {
        await this.mail.add(
          'send',
          { to: user.email, subject: `[Bilgisayar Müh. ÇAP/YDP] ${title}`, text: `${body}\n\n${link ? `Ayrıntı: http://localhost:3000${link}` : ''}` },
          { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 100 },
        );
      } catch (e) {
        this.logger.warn(`E-posta kuyruğa alınamadı: ${(e as Error).message}`);
      }
    }
  }

  /** Etkin bütün koordinatörlere bildirim. */
  async notifyCoordinators(title: string, body: string, link?: string) {
    const rows = await this.prisma.user.findMany({ where: { role: 'KOORDINATOR', active: true }, select: { username: true } });
    await this.notifyMany(rows.map((r) => r.username), title, body, link);
  }

  async notifyMany(usernames: string[], title: string, body: string, link?: string) {
    for (const u of new Set(usernames)) await this.notify(u, title, body, link);
  }

  list(username: string) {
    return this.prisma.notification.findMany({ where: { username }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  unreadCount(username: string) {
    return this.prisma.notification.count({ where: { username, readAt: null } });
  }
}

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  constructor(private readonly mailer: MailPort) {
    super();
  }

  async process(job: Job<MailJob>) {
    await this.mailer.send(job.data.to, job.data.subject, job.data.text);
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return {
      unread: await this.service.unreadCount(user.username),
      items: await this.service.list(user.username),
    };
  }

  @Post('read-all')
  @ReadOnlySafe()
  async readAll(@CurrentUser() user: AuthUser) {
    await this.prisma.notification.updateMany({ where: { username: user.username, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  @Post(':id/read')
  @ReadOnlySafe()
  async read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, username: user.username } });
    if (!n) throw notFound('Bildirim');
    await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
    return { ok: true };
  }
}
