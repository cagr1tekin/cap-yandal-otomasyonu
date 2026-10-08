import { Controller, Get, Query } from '@nestjs/common';
import { HealthCheck, HealthCheckService, type HealthIndicatorResult } from '@nestjs/terminus';
import { CurrentUser, Public, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { CatalogService, windowState } from '../catalog/catalog.service';
import { CacheService } from '../integrations/cache.service';
import { LinkRegistry } from '../integrations/integrations.module';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly links: LinkRegistry,
    private readonly catalog: CatalogService,
    private readonly access: AccessService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const programIds = user.assignments.map((a) => a.programId).filter(Boolean) as string[];
    const [programs, term, home] = await Promise.all([this.prisma.program.findMany({ where: { id: { in: programIds } } }), this.catalog.currentTerm(), this.access.home()]);
    return {
      ...user,
      programs,
      home,
      // Bilgisayar Mühendisliği bölüm başkanı (yönetici) ya da yalnızca ana dal bölümünün imzacısı
      homeHead: this.access.headProgramIds(user).includes(home.id),
      mainDepartmentSigner: user.assignments.some((a) => a.role !== 'KOORDINATOR' && a.programId !== home.id),
      currentTerm: term,
    };
  }

  @Public()
  @Get('links')
  allLinks() {
    return this.links.all();
  }
}

@Controller('reports')
@Roles('BOLUM_BASKANI', 'KOORDINATOR')
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** Dönem özeti: teklif bazında başvuru, kabul, doluluk; ana dal bölümüne göre dağılım; kayıt durumları. */
  @Get('summary')
  async summary(@CurrentUser() user: AuthUser, @Query('termId') termId?: string) {
    await this.access.assertDepartmentStaff(user);
    const term = termId ? await this.prisma.term.findUnique({ where: { id: termId } }) : await this.prisma.term.findFirst({ where: { isCurrent: true } });
    const offerings = await this.prisma.offering.findMany({ where: { termId: term?.id }, orderBy: { type: 'asc' } });
    const ids = offerings.map((o) => o.id);
    const [appCounts, enrollCounts, pending, byProgram, programs] = await Promise.all([
      this.prisma.application.groupBy({ by: ['offeringId', 'status'], where: { offeringId: { in: ids } }, _count: true }),
      this.prisma.enrollment.groupBy({ by: ['type', 'status'], _count: true }),
      this.prisma.scanFinding.count({ where: { decision: 'PENDING' } }),
      this.prisma.enrollment.findMany({ where: { status: { in: ['ACTIVE', 'FROZEN'] } }, select: { type: true, student: { select: { programId: true } } } }),
      this.prisma.program.findMany({ where: { isHome: false }, orderBy: { name: 'asc' } }),
    ]);
    const rows = offerings.map((o) => {
      const c = (s: string) => appCounts.find((x) => x.offeringId === o.id && x.status === s)?._count ?? 0;
      const total = appCounts.filter((x) => x.offeringId === o.id && x.status !== 'WITHDRAWN').reduce((t, x) => t + x._count, 0);
      const enrolled = c('ENROLLED');
      const accepted = c('ACCEPTED') + enrolled;
      return {
        offeringId: o.id,
        type: o.type,
        quota: o.quota,
        window: windowState(o),
        applications: total,
        ineligible: c('INELIGIBLE'),
        accepted,
        waitlisted: c('WAITLISTED'),
        enrolled,
        fillRate: o.quota ? Math.round((accepted / o.quota) * 100) : 0,
      };
    });
    const count = (type: string, ...statuses: string[]) => enrollCounts.filter((x) => x.type === type && statuses.includes(x.status)).reduce((t, x) => t + x._count, 0);
    return {
      term,
      rows,
      enrollments: (['CAP', 'YANDAL'] as const).map((type) => ({
        type,
        active: count(type, 'ACTIVE', 'FROZEN'),
        completed: count(type, 'COMPLETED'),
        withdrawn: count(type, 'WITHDRAWN'),
        removed: count(type, 'REMOVED'),
      })),
      byProgram: programs.map((p) => ({
        programName: p.name,
        cap: byProgram.filter((e) => e.type === 'CAP' && e.student.programId === p.id).length,
        yandal: byProgram.filter((e) => e.type === 'YANDAL' && e.student.programId === p.id).length,
      })),
      pendingFindings: pending,
    };
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
    return this.health.check([
      () => this.check('veritabani', async () => (await this.prisma.$queryRaw`SELECT 1`) !== null),
      () => this.check('redis', () => this.cache.ping()),
    ]);
  }
}
