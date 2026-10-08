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
  role: Role | 'IMZA';
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
    add({ key: 'approvals', role: 'IMZA', title: 'İmzanızı bekleyen formlar', detail: 'Protokol, ders kayıt formu ve muafiyet formları', count: approvals.length, link: '/onaylar' });

    if (this.access.isStudent(user)) {
      const no = user.studentNo;
      add({ key: 'profile', role: 'OGRENCI', title: 'Bilgilerinizi girin', detail: 'Başvuru için öğrenci ve akademik bilgileriniz gerekli', count: no ? 0 : 1, link: '/ogrenci/bilgilerim' });
      if (no) {
        const [open, accepted, needReg, noRecord] = await Promise.all([
          term ? this.prisma.offering.count({ where: { termId: term.id, status: 'PUBLISHED', opensAt: { lte: now }, closesAt: { gte: now }, applications: { none: { studentNo: no, status: { notIn: ['WITHDRAWN'] } } } } }) : 0,
          this.prisma.application.count({ where: { studentNo: no, status: 'ACCEPTED', offering: { registrationClosedAt: null, decisions: { some: { publishedAt: { not: null } } } } } }),
          term ? this.prisma.enrollment.count({ where: { studentNo: no, status: 'ACTIVE', protocol: { status: 'APPROVED' }, courseRegistrations: { none: { termId: term.id } } } }) : 0,
          term ? this.prisma.enrollment.count({ where: { studentNo: no, status: { in: ['ACTIVE', 'FROZEN'] }, startTerm: { startsAt: { lt: term.startsAt } }, termRecords: { none: { term: { endsAt: { lt: now } } } } } }) : 0,
        ]);
        add({ key: 'apply', role: 'OGRENCI', title: 'Başvuruya açık program', detail: 'Uygunluğunuzu görün ve başvurun', count: open, link: '/ogrenci/basvuru' });
        add({ key: 'accept', role: 'OGRENCI', title: 'Kesin kaydınızı onaylayın', detail: 'Kabul edildiniz; kayıt süresi dolmadan onaylayın', count: accepted, link: '/ogrenci/basvuru' });
        add({ key: 'courseReg', role: 'OGRENCI', title: 'Bu dönemin ders kayıt formu', detail: 'Alacağınız dersleri seçip imzaya gönderin', count: needReg, link: '/ogrenci/kayitlarim' });
        add({ key: 'termRecord', role: 'OGRENCI', title: 'Dönem sonu beyanı', detail: 'Biten dönemin ana dal GNO’sunu girin', count: noRecord, link: '/ogrenci/kayitlarim' });
      }
    }

    if (this.access.isCoordinator(user)) {
      const [toVerify, toLock, awaitingDecision, unpublished, noProtocol, draftProtocol, findings, records, drafts] = await Promise.all([
        this.prisma.application.count({ where: { verification: 'PENDING', status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
        this.prisma.offering.count({ where: { rankingLockedAt: null, status: 'PUBLISHED', closesAt: { lt: now }, applications: { some: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } } } }),
        this.prisma.offering.count({ where: { rankingLockedAt: { not: null }, decisions: { none: {} } } }),
        this.prisma.boardDecision.count({ where: { publishedAt: null } }),
        this.prisma.enrollment.count({ where: { status: 'ACTIVE', protocol: null } }),
        this.prisma.protocol.count({ where: { status: { in: ['DRAFT', 'REJECTED'] }, enrollment: { status: 'ACTIVE' } } }),
        this.prisma.scanFinding.count({ where: { decision: 'PENDING' } }),
        this.prisma.termRecord.count({ where: { verifiedAt: null, enrollment: { status: { in: ['ACTIVE', 'FROZEN'] } } } }),
        this.prisma.ruleSet.count({ where: { status: 'DRAFT' } }),
      ]);
      add({ key: 'verify', role: 'KOORDINATOR', title: 'Beyanı doğrulanacak başvurular', detail: 'Öğrencinin girdiği bilgileri belgeleriyle karşılaştırın', count: toVerify, link: '/koordinator/basvurular?dogrulama=PENDING' });
      add({ key: 'lock', role: 'KOORDINATOR', title: 'Sıralaması kilitlenecek teklifler', detail: 'Başvuru dönemi kapandı', count: toLock, link: '/koordinator/degerlendirme' });
      add({ key: 'decision', role: 'KOORDINATOR', title: 'Kurul kararı girilecek teklifler', detail: 'Komisyon önerisi kilitlendi', count: awaitingDecision, link: '/koordinator/degerlendirme' });
      add({ key: 'publish', role: 'KOORDINATOR', title: 'Yayımlanmamış sonuçlar', detail: 'Karar girildi, ilan edilmedi', count: unpublished, link: '/koordinator/degerlendirme' });
      add({ key: 'protocol', role: 'KOORDINATOR', title: 'Protokolü hazırlanacak öğrenciler', detail: 'Kesin kaydını onayladı, protokol yok', count: noProtocol, link: '/koordinator/ogrenciler' });
      add({ key: 'protocolDraft', role: 'KOORDINATOR', title: 'Taslak ya da reddedilmiş protokoller', detail: 'Düzeltip imzaya gönderin', count: draftProtocol, link: '/koordinator/ogrenciler' });
      add({ key: 'records', role: 'KOORDINATOR', title: 'Doğrulanacak dönem beyanları', detail: 'Öğrencinin girdiği ana dal GNO’su', count: records, link: '/koordinator/ogrenciler' });
      add({ key: 'findings', role: 'KOORDINATOR', title: 'Karar bekleyen tarama bulguları', detail: 'Kayıt silme adayları ve uyarılar', count: findings, link: '/koordinator/taramalar' });
      add({ key: 'rules', role: 'KOORDINATOR', title: 'Taslak kural sürümleri', detail: 'Deneme çalıştırıp etkinleştirin', count: drafts, link: '/koordinator/kurallar' });
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
    private readonly access: AccessService,
  ) {}

  @Get('me/tasks')
  myTasks(@CurrentUser() user: AuthUser) {
    return this.tasks.forUser(user);
  }

  /** Personel hesapları ve rolleri. Öğrenci hesapları ayrı sayılır (rol atanmaz). */
  @Get('users')
  @Roles('BOLUM_BASKANI', 'KOORDINATOR')
  async users(@CurrentUser() user: AuthUser) {
    await this.access.assertDepartmentStaff(user);
    const rows = await this.prisma.user.findMany({ include: { assignments: { include: { program: true } }, profile: { select: { studentNo: true, program: { select: { name: true } } } } }, orderBy: { username: 'asc' } });
    return {
      staff: rows.filter((u) => u.assignments.length),
      students: rows.filter((u) => !u.assignments.length).map((u) => ({ id: u.id, username: u.username, displayName: u.displayName, email: u.email, lastLoginAt: u.lastLoginAt, studentNo: u.profile?.studentNo ?? null, mainProgramName: u.profile?.program.name ?? null })),
      canManage: await this.access.isHomeHead(user),
    };
  }

  @Post('users')
  @Roles('BOLUM_BASKANI')
  async createUser(@CurrentUser() actor: AuthUser, @Body(new ZodPipe(UserCreateSchema)) body: z.infer<typeof UserCreateSchema>) {
    await this.access.assertHomeHead(actor);
    const exists = await this.prisma.user.findUnique({ where: { username: body.username } });
    if (exists) throw conflict('Bu kullanıcı adı zaten var.');
    const u = await this.prisma.user.create({ data: body });
    await this.audit.log({ actor: actor.username, action: 'USER_CREATE', entity: 'User', entityId: u.id, after: body });
    return u;
  }

  /** Rol atamasını Bilgisayar Mühendisliği bölüm başkanı yapar (ÇAP Yön. m.6: koordinatörü bölüm başkanı atar). */
  @Post('users/:username/assignments')
  @Roles('BOLUM_BASKANI')
  async assign(@CurrentUser() actor: AuthUser, @Param('username') username: string, @Body(new ZodPipe(AssignmentSchema)) body: z.infer<typeof AssignmentSchema>) {
    await this.access.assertHomeHead(actor);
    const u = await this.prisma.user.findUnique({ where: { username }, include: { profile: true, assignments: true } });
    if (!u) throw notFound('Kullanıcı');
    if (u.profile) throw conflict('Öğrenci hesabına personel rolü atanamaz.');
    const home = await this.access.home();
    if (body.role === 'KOORDINATOR' && body.programId && body.programId !== home.id) throw badRequest('Koordinatör rolü yalnızca Bilgisayar Mühendisliği içindir.');
    if ((body.role === 'BOLUM_BASKANI' || body.role === 'DANISMAN') && !body.programId) throw badRequest(`${LABELS.role[body.role]} rolü için bölüm seçin.`);
    if (body.role === 'DANISMAN' && body.programId === home.id) throw badRequest('Danışman rolü öğrencinin ana dal bölümü içindir; Bilgisayar Mühendisliği seçilemez.');
    const programId = body.role === 'KOORDINATOR' ? null : body.programId!;
    if (u.assignments.some((a) => a.role === body.role && a.programId === programId)) throw conflict('Bu rol zaten atanmış.');
    const a = await this.prisma.roleAssignment.create({ data: { userId: u.id, role: body.role, programId } });
    await this.audit.log({ actor: actor.username, action: 'ROLE_ASSIGN', entity: 'User', entityId: u.id, after: { username, role: body.role, programId } });
    return a;
  }

  @Delete('assignments/:id')
  @Roles('BOLUM_BASKANI')
  async unassign(@CurrentUser() actor: AuthUser, @Param('id') id: string) {
    await this.access.assertHomeHead(actor);
    const a = await this.prisma.roleAssignment.findUnique({ where: { id } });
    if (!a) throw notFound('Rol ataması');
    const home = await this.access.home();
    if (a.role === 'BOLUM_BASKANI' && a.programId === home.id) {
      const others = await this.prisma.roleAssignment.count({ where: { role: 'BOLUM_BASKANI', programId: home.id, id: { not: id } } });
      if (others === 0) throw conflict('Son bölüm başkanı yetkisi kaldırılamaz.');
    }
    await this.prisma.roleAssignment.delete({ where: { id } });
    await this.audit.log({ actor: actor.username, action: 'ROLE_UNASSIGN', entity: 'User', entityId: a.userId, before: a });
    return { ok: true };
  }

  @Get('audit')
  @Roles('BOLUM_BASKANI', 'KOORDINATOR')
  async auditLog(@CurrentUser() user: AuthUser, @Query('entity') entity?: string, @Query('actor') actor?: string, @Query('action') action?: string, @Query('take') take = '100') {
    await this.access.assertDepartmentStaff(user);
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
