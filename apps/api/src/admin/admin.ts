import { Body, Controller, Delete, Get, Injectable, Param, Post, Query } from '@nestjs/common';
import { AssignmentSchema, LABELS, UserCreateSchema, type Role } from '@cap/contracts';
import type { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { AuditService } from '../audit/audit.service';
import { CatalogService } from '../catalog/catalog.service';
import { badRequest, conflict, notFound, ZodPipe } from '../common/http';
import { FormsService } from '../forms/forms.service';
import { PrismaService } from '../prisma/prisma.service';

export interface Task {
  key: string;
  role: Role | 'ONAY';
  title: string;
  detail: string;
  count: number;
  link: string;
}

/** Rol bazlı "Görevlerim": kullanıcının o an yapması gereken işler. */
@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly catalog: CatalogService,
    private readonly forms: FormsService,
  ) {}

  async forUser(user: AuthUser): Promise<{ tasks: Task[]; term: { id: string; year: string; season: string } | null }> {
    const term = await this.catalog.currentTerm();
    const tasks: Task[] = [];
    const add = (t: Task) => t.count > 0 && tasks.push(t);
    const now = new Date();

    const approvals = await this.forms.myApprovals(user);
    add({ key: 'approvals', role: 'ONAY', title: 'İmzanızı bekleyen formlar', detail: 'Kabul ve Ders Protokolü ve ders kayıt formları', count: approvals.length, link: '/onaylar' });

    if (user.roles.includes('BIRIM') || user.roles.includes('OIDB')) {
      const scope = this.access.isOidb(user) ? {} : { program: { unitId: { in: this.access.unitIds(user) } } };
      const unitWhere = this.access.isOidb(user) ? {} : { unitId: { in: this.access.unitIds(user) } };
      const [openWindows, awaitingDecision, unpublished, accepted, toFile, toEnter, findings] = await Promise.all([
        term ? this.prisma.applicationWindow.count({ where: { termId: term.id, opensAt: { lte: now }, closesAt: { gte: now }, ...unitWhere } }) : 0,
        this.prisma.offering.count({ where: { ...scope, rankingLockedAt: { not: null }, decisions: { none: {} } } }),
        this.prisma.boardDecision.count({ where: { publishedAt: null, offering: scope } }),
        this.prisma.application.count({ where: { status: 'ACCEPTED', offering: { ...scope, registrationClosedAt: null } } }),
        this.prisma.protocol.count({ where: { status: 'APPROVED', enrollment: { offering: scope } } }),
        term ? this.prisma.courseRegistration.count({ where: { termId: term.id, status: 'SUBMITTED', enrollment: { offering: scope } } }) : 0,
        this.prisma.scanFinding.count({ where: { decision: 'PENDING', enrollment: { offering: scope } } }),
      ]);
      add({ key: 'intake', role: 'BIRIM', title: 'Başvuru dönemi açık', detail: 'Şahsen gelen dilekçeleri panele girin', count: openWindows, link: '/birim/basvurular/yeni' });
      add({ key: 'decision', role: 'BIRIM', title: 'Yönetim kurulu kararı bekleyen teklifler', detail: 'Bölüm önerisi kilitlendi', count: awaitingDecision, link: '/birim/kararlar' });
      add({ key: 'publish', role: 'BIRIM', title: 'Yayımlanmamış sonuçlar', detail: 'Karar girildi, ilan edilmedi', count: unpublished, link: '/birim/kararlar' });
      add({ key: 'register', role: 'BIRIM', title: 'Kesin kaydı bekleyen asiller', detail: 'Belgeler teslim alınınca kayıt işlenir', count: accepted, link: '/birim/kararlar' });
      add({ key: 'file', role: 'BIRIM', title: 'Dosyalanacak protokoller', detail: 'İmzalar tamam; aslı öğrenci dosyasına', count: toFile, link: '/birim/protokoller' });
      add({ key: 'obis', role: 'BIRIM', title: "OBİS'e girilecek ders kayıt formları", detail: 'Koordinatörlerin teslim ettiği formlar', count: toEnter, link: '/birim/ders-kayitlari' });
      add({ key: 'findings', role: 'BIRIM', title: 'Karar bekleyen tarama bulguları', detail: 'Kayıt silme adayları ve uyarılar', count: findings, link: '/birim/taramalar' });
    }

    if (user.roles.includes('KOORDINATOR')) {
      const mine = { coordinatorUsername: user.username };
      const [toLock, noProtocol, draftProtocol, approvedRegs, needReg] = await Promise.all([
        this.prisma.offering.count({ where: { ...mine, rankingLockedAt: null, status: 'PUBLISHED', applications: { some: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } } } }),
        this.prisma.enrollment.count({ where: { status: 'ACTIVE', protocol: null, offering: mine } }),
        this.prisma.protocol.count({ where: { status: { in: ['DRAFT', 'REJECTED'] }, enrollment: { offering: mine } } }),
        term ? this.prisma.courseRegistration.count({ where: { termId: term.id, status: 'APPROVED', enrollment: { offering: mine } } }) : 0,
        term
          ? this.prisma.enrollment.count({
              where: { status: 'ACTIVE', offering: mine, protocol: { status: { in: ['APPROVED', 'FILED'] } }, courseRegistrations: { none: { termId: term.id } } },
            })
          : 0,
      ]);
      add({ key: 'lock', role: 'KOORDINATOR', title: 'Değerlendirme bekleyen başvurular', detail: 'Sıralamayı inceleyip öneriyi kilitleyin', count: toLock, link: '/koordinator' });
      add({ key: 'protocol', role: 'KOORDINATOR', title: 'Protokolü hazırlanacak öğrenciler', detail: 'Kesin kaydı yapıldı, protokol yok', count: noProtocol, link: '/koordinator' });
      add({ key: 'protocolDraft', role: 'KOORDINATOR', title: 'Taslak ya da reddedilmiş protokoller', detail: 'Düzeltip onaya gönderin', count: draftProtocol, link: '/koordinator' });
      add({ key: 'courseReg', role: 'KOORDINATOR', title: 'Bu dönem ders kaydı yapılmamış öğrenciler', detail: 'Ders kayıt formu hazırlayın', count: needReg, link: '/koordinator' });
      add({ key: 'batch', role: 'KOORDINATOR', title: 'Teslim edilecek onaylı ders kayıt formları', detail: 'Öğrenci işlerine toplu teslim', count: approvedRegs, link: '/koordinator/teslim' });
    }

    if (user.roles.includes('OIDB')) {
      const [drafts, noRole] = await Promise.all([
        this.prisma.ruleSet.count({ where: { status: 'DRAFT' } }),
        this.prisma.user.count({ where: { assignments: { none: {} } } }),
      ]);
      add({ key: 'rules', role: 'OIDB', title: 'Taslak kural sürümleri', detail: 'Deneme çalıştırıp etkinleştirin', count: drafts, link: '/oidb/kurallar' });
      add({ key: 'users', role: 'OIDB', title: 'Rolü atanmamış kullanıcılar', detail: 'Giriş yapmış ama yetkisi yok', count: noRole, link: '/oidb/kullanicilar' });
    }
    return { tasks, term };
  }
}

@Controller()
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tasks: TasksService,
  ) {}

  @Get('me/tasks')
  myTasks(@CurrentUser() user: AuthUser) {
    return this.tasks.forUser(user);
  }

  @Get('users')
  @Roles('OIDB')
  users() {
    return this.prisma.user.findMany({ include: { assignments: true }, orderBy: { username: 'asc' } });
  }

  @Post('users')
  @Roles('OIDB')
  async createUser(@CurrentUser() actor: AuthUser, @Body(new ZodPipe(UserCreateSchema)) body: z.infer<typeof UserCreateSchema>) {
    const exists = await this.prisma.user.findUnique({ where: { username: body.username } });
    if (exists) throw conflict('Bu kullanıcı adı zaten var.');
    const u = await this.prisma.user.create({ data: body });
    await this.audit.log({ actor: actor.username, action: 'USER_CREATE', entity: 'User', entityId: u.id, after: body });
    return u;
  }

  @Post('users/:username/assignments')
  @Roles('OIDB')
  async assign(@CurrentUser() actor: AuthUser, @Param('username') username: string, @Body(new ZodPipe(AssignmentSchema)) body: z.infer<typeof AssignmentSchema>) {
    const u = await this.prisma.user.findUnique({ where: { username } });
    if (!u) throw notFound('Kullanıcı');
    if (body.role === 'BIRIM' && !body.unitId) throw badRequest('Birim öğrenci işleri rolü için birim seçin.');
    if ((body.role === 'BOLUM_BASKANI' || body.role === 'KOORDINATOR') && !body.programId) throw badRequest(`${LABELS.role[body.role]} rolü için program seçin.`);
    const a = await this.prisma.roleAssignment.create({ data: { userId: u.id, role: body.role, unitId: body.unitId ?? null, programId: body.programId ?? null } });
    await this.audit.log({ actor: actor.username, action: 'ROLE_ASSIGN', entity: 'User', entityId: u.id, after: body });
    return a;
  }

  @Delete('assignments/:id')
  @Roles('OIDB')
  async unassign(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    const a = await this.prisma.roleAssignment.findUnique({ where: { id } });
    if (!a) throw notFound('Rol ataması');
    if (a.userId && actor.assignments.some((x) => x.role === 'OIDB') && a.role === 'OIDB') {
      const others = await this.prisma.roleAssignment.count({ where: { role: 'OIDB', id: { not: id } } });
      if (others === 0) throw conflict('Son ÖİDB yetkisi kaldırılamaz.');
    }
    await this.prisma.roleAssignment.delete({ where: { id } });
    await this.audit.log({ actor: actor.username, action: 'ROLE_UNASSIGN', entity: 'User', entityId: a.userId, before: a });
    return { ok: true };
  }

  @Get('audit')
  @Roles('OIDB')
  async auditLog(@Query('entity') entity?: string, @Query('actor') actor?: string, @Query('action') action?: string, @Query('take') take = '100') {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(entity ? { entity } : {}),
        ...(actor ? { actor: { contains: actor } } : {}),
        ...(action ? { action: { contains: action.toUpperCase() } } : {}),
      },
      orderBy: { at: 'desc' },
      take: Math.min(500, Number(take) || 100),
    });
    return rows.map((r) => ({ ...r, id: r.id.toString() }));
  }
}
