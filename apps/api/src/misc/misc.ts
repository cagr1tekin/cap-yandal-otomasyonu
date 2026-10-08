import { Controller, Get, Query } from '@nestjs/common';
import { HealthCheck, HealthCheckService, type HealthIndicatorResult } from '@nestjs/terminus';
import type { Prisma } from '@prisma/client';
import { CurrentUser, Public, Roles, type AuthUser } from '../auth/auth';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog';
import { CacheService } from '../integrations/cache.service';
import { LinkRegistry } from '../integrations/integrations.module';
import { PrismaService } from '../prisma/prisma.service';

export interface Task {
  key: string;
  title: string;
  detail: string;
  count: number;
  link: string;
}

@Controller()
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly links: LinkRegistry,
    private readonly catalog: CatalogService,
    private readonly audit: AuditService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    return { ...user, currentTerm: await this.catalog.currentTerm() };
  }

  /** Rol bazlı "Görevlerim": kullanıcının o an yapması gereken işler. */
  @Get('me/tasks')
  async tasks(@CurrentUser() user: AuthUser) {
    const term = await this.catalog.currentTerm();
    const tasks: Task[] = [];
    const add = (t: Task) => t.count > 0 && tasks.push(t);

    if (user.role === 'OGRENCI' && user.studentNo) {
      const no = user.studentNo;
      const s = await this.prisma.student.findUniqueOrThrow({ where: { studentNo: no } });
      const [requests, rejected, unread, plan, current, ungraded, protocol] = await Promise.all([
        this.prisma.documentRequest.count({ where: { studentNo: no, status: { in: ['OPEN', 'REJECTED'] } } }),
        this.prisma.document.count({ where: { studentNo: no, status: 'REJECTED', next: null } }),
        this.prisma.message.count({ where: { studentNo: no, readAt: null, NOT: { senderId: user.id } } }),
        this.prisma.planItem.count({ where: { studentNo: no, status: 'APPROVED', removedAt: null } }),
        term ? this.prisma.courseAttempt.count({ where: { studentNo: no, termId: term.id, status: { in: ['PENDING', 'APPROVED'] } } }) : 1,
        this.prisma.courseAttempt.count({ where: { studentNo: no, status: 'APPROVED', result: 'TAKEN', term: { endsAt: { lt: new Date() } }, gradeItems: { none: { submission: { status: 'PENDING' } } } } }),
        this.prisma.document.count({ where: { studentNo: no, kind: 'PROTOKOL', status: { in: ['PENDING', 'APPROVED'] } } }),
      ]);
      const active = s.status === 'ACTIVE';
      add({ key: 'protocol', title: 'İmzalı protokolünüzü yükleyin', detail: 'Kabul ve Ders Protokolü (ana dalınızda imzalatılmış, taranmış)', count: protocol ? 0 : 1, link: `/ogrenciler/${no}?sekme=belgeler` });
      add({ key: 'requests', title: 'Koordinatörün istediği belgeler', detail: 'Bekleyen ya da reddedilen istekler', count: requests, link: `/ogrenciler/${no}?sekme=belgeler` });
      add({ key: 'rejected', title: 'Reddedilen belgeler', detail: 'Yeni sürümünü yükleyin', count: rejected, link: `/ogrenciler/${no}?sekme=belgeler` });
      add({ key: 'plan', title: 'Alacağınız dersleri girin', detail: 'Ders listeniz henüz yok; katalogdan seçin', count: active && plan === 0 ? 1 : 0, link: `/ogrenciler/${no}?sekme=dersler` });
      add({ key: 'term', title: 'Bu dönem aldığınız dersleri girin', detail: term ? `${term.year} ${term.season === 'GUZ' ? 'Güz' : 'Bahar'}` : '', count: active && plan > 0 && current === 0 ? 1 : 0, link: `/ogrenciler/${no}?sekme=dersler` });
      add({ key: 'grades', title: 'Notu girilmemiş dersler', detail: 'Biten dönemin notlarını ve not belgesini gönderin', count: active ? ungraded : 0, link: `/ogrenciler/${no}?sekme=notlar` });
      add({ key: 'messages', title: 'Okunmamış mesaj', detail: 'Koordinatörden', count: unread, link: `/ogrenciler/${no}?sekme=mesajlar` });
      return { tasks, term };
    }

    const [plan, attempts, grades, docs, requests, unread, students, overdue, uninvited] = await Promise.all([
      this.prisma.planItem.count({ where: { status: 'PENDING', removedAt: null } }),
      this.prisma.courseAttempt.count({ where: { status: 'PENDING' } }),
      this.prisma.gradeSubmission.count({ where: { status: 'PENDING' } }),
      this.prisma.document.count({ where: { status: 'PENDING' } }),
      this.prisma.courseRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.message.count({ where: { readAt: null, sender: { role: 'OGRENCI' } } }),
      this.prisma.student.findMany({ where: { status: { in: ['ACTIVE', 'FROZEN'] } }, select: { ruleChecks: { orderBy: { createdAt: 'desc' }, take: 1, select: { worst: true, results: true } } } }),
      this.prisma.documentRequest.count({ where: { status: 'OPEN', dueDate: { lt: new Date() } } }),
      this.prisma.user.count({ where: { role: 'OGRENCI', invitedAt: null, active: true } }),
    ]);
    const last = students.map((s) => s.ruleChecks[0]).filter(Boolean);
    add({ key: 'reviews', title: 'Onay bekleyen kayıtlar', detail: `${plan} ders listesi, ${attempts} dönem dersi, ${grades} not gönderimi, ${docs} belge`, count: plan + attempts + grades + docs, link: '/onaylar' });
    add({ key: 'courseRequests', title: 'Katalog dışı ders talepleri', detail: 'Kataloğa ekleyip onaylayın ya da reddedin', count: requests, link: '/katalog?sekme=talepler' });
    add({ key: 'messages', title: 'Okunmamış öğrenci mesajları', detail: 'Mesajlar', count: unread, link: '/mesajlar' });
    add({ key: 'fail', title: 'Kayıt silme uyarısı olan öğrenciler', detail: 'Son kural kontrolüne göre; karar sizde', count: last.filter((c) => c.worst === 'FAIL').length, link: '/kontrol' });
    add({ key: 'warn', title: 'Uyarısı olan öğrenciler', detail: 'Son kural kontrolüne göre', count: last.filter((c) => c.worst === 'WARN').length, link: '/kontrol' });
    add({ key: 'ready', title: 'Mezuniyete / sertifikaya hazır öğrenciler', detail: 'Karar verilmesi bekleniyor', count: last.filter((c) => (c.results as { graduationReady?: boolean }).graduationReady).length, link: '/ogrenciler?flag=mezuniyet' });
    add({ key: 'overdue', title: 'Süresi geçmiş belge istekleri', detail: 'Öğrenci yanıtlamadı', count: overdue, link: '/ogrenciler' });
    add({ key: 'uninvited', title: 'Daveti gönderilmemiş öğrenci hesapları', detail: 'Geriye dönük eklenen öğrenciler', count: uninvited, link: '/kullanicilar' });
    return { tasks, term };
  }

  @Public()
  @Get('links')
  allLinks() {
    return this.links.all();
  }

  /** İşlem kaydı: koordinatör ve bölüm başkanı görür. */
  @Get('audit')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  auditLog(@Query('actor') actor?: string, @Query('action') action?: string, @Query('studentNo') studentNo?: string, @Query('entity') entity?: string, @Query('take') take?: string) {
    const where: Prisma.AuditLogWhereInput = {
      ...(actor ? { actor: { contains: actor } } : {}),
      ...(action ? { action: { contains: action.toUpperCase() } } : {}),
      ...(studentNo ? { studentNo } : {}),
      ...(entity ? { entity } : {}),
    };
    return this.audit.list(where, Number(take) || 200);
  }

  /** Özet sayılar (pano ve bölüm başkanı). */
  @Get('reports/summary')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  async summary() {
    const [byStatus, docs, messages] = await Promise.all([
      this.prisma.student.groupBy({ by: ['track', 'status'], _count: true }),
      this.prisma.document.groupBy({ by: ['status'], _count: true }),
      this.prisma.message.count(),
    ]);
    return { byStatus, docs, messages };
  }
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private async check(key: string, fn: () => Promise<boolean>): Promise<HealthIndicatorResult> {
    const up = await fn().catch(() => false);
    if (!up) throw new Error(`${key} erişilemiyor`);
    return { [key]: { status: 'up' } };
  }

  @Public()
  @Get()
  @HealthCheck()
  run() {
    return this.health.check([() => this.check('veritabani', async () => (await this.prisma.$queryRaw`SELECT 1`) !== null), () => this.check('redis', () => this.cache.ping())]);
  }
}
