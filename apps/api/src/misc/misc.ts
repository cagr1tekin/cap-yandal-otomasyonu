import { Controller, Get, Query } from '@nestjs/common';
import { HealthCheck, HealthCheckService, type HealthIndicatorResult } from '@nestjs/terminus';
import { CurrentUser, Public, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { CatalogService } from '../catalog/catalog.service';
import { CacheService } from '../integrations/cache.service';
import { LinkRegistry } from '../integrations/integrations.module';
import { ObisPort } from '../integrations/obis.port';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class MeController {
  constructor(
    private readonly obis: ObisPort,
    private readonly prisma: PrismaService,
    private readonly links: LinkRegistry,
    private readonly catalog: CatalogService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const unitIds = user.assignments.map((a) => a.unitId).filter(Boolean) as string[];
    const programIds = user.assignments.map((a) => a.programId).filter(Boolean) as string[];
    const [units, programs, coordinated, term] = await Promise.all([
      this.prisma.unit.findMany({ where: { id: { in: unitIds } } }),
      this.prisma.program.findMany({ where: { id: { in: programIds } } }),
      user.roles.includes('KOORDINATOR')
        ? this.prisma.offering.findMany({
            where: { coordinatorUsername: user.username },
            include: { program: true, term: true },
            orderBy: { term: { startsAt: 'desc' } },
          })
        : [],
      this.catalog.currentTerm(),
    ]);
    return { ...user, units, programs, coordinated, currentTerm: term };
  }

  @Public()
  @Get('links')
  allLinks() {
    return this.links.all();
  }
}

@Controller('reports')
@Roles('BIRIM', 'OIDB', 'BOLUM_BASKANI', 'KOORDINATOR')
export class ReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  /** US-31: program bazında başvuru, kabul, kontenjan doluluğu, kayıt durumu ve bekleyen bulgular. */
  @Get('summary')
  async summary(@CurrentUser() user: AuthUser, @Query('termId') termId?: string) {
    const term = termId
      ? await this.prisma.term.findUnique({ where: { id: termId } })
      : await this.prisma.term.findFirst({ where: { isCurrent: true } });
    const offerings = await this.prisma.offering.findMany({
      where: { AND: [this.access.offeringWhere(user), { termId: term?.id }] },
      include: { program: { include: { unit: true } } },
      orderBy: [{ program: { unit: { name: 'asc' } } }, { program: { name: 'asc' } }],
    });
    const ids = offerings.map((o) => o.id);
    const programIds = [...new Set(offerings.map((o) => o.programId))];
    const [appCounts, enrollCounts, pending] = await Promise.all([
      this.prisma.application.groupBy({ by: ['offeringId', 'status'], where: { offeringId: { in: ids } }, _count: true }),
      this.prisma.enrollment.groupBy({ by: ['programId', 'type', 'status'], where: { programId: { in: programIds } }, _count: true }),
      this.prisma.scanFinding.count({
        where: { decision: 'PENDING', enrollment: { programId: { in: programIds } } },
      }),
    ]);
    const rows = offerings.map((o) => {
      const c = (s: string) => appCounts.find((x) => x.offeringId === o.id && x.status === s)?._count ?? 0;
      const total = appCounts.filter((x) => x.offeringId === o.id && x.status !== 'WITHDRAWN').reduce((t, x) => t + x._count, 0);
      const enrolled = c('ENROLLED');
      const accepted = c('ACCEPTED') + enrolled;
      const active = enrollCounts
        .filter((x) => x.programId === o.programId && x.type === o.type && (x.status === 'ACTIVE' || x.status === 'FROZEN'))
        .reduce((t, x) => t + x._count, 0);
      const removed = enrollCounts
        .filter((x) => x.programId === o.programId && x.type === o.type && x.status === 'REMOVED')
        .reduce((t, x) => t + x._count, 0);
      return {
        offeringId: o.id,
        unitName: o.program.unit.name,
        programName: o.program.name,
        type: o.type,
        quota: o.quota,
        applications: total,
        accepted,
        enrolled,
        fillRate: o.quota ? Math.round((accepted / o.quota) * 100) : 0,
        activeEnrollments: active,
        removedEnrollments: removed,
      };
    });
    const sum = (k: 'applications' | 'accepted' | 'enrolled' | 'quota' | 'activeEnrollments' | 'removedEnrollments') =>
      rows.reduce((t, r) => t + r[k], 0);
    return {
      term,
      totals: {
        offerings: rows.length,
        quota: sum('quota'),
        applications: sum('applications'),
        accepted: sum('accepted'),
        enrolled: sum('enrolled'),
        activeEnrollments: sum('activeEnrollments'),
        removedEnrollments: sum('removedEnrollments'),
        pendingFindings: pending,
      },
      rows,
    };
  }
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly obis: ObisPort,
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
      () => this.check('obis', () => this.obis.ping()),
    ]);
  }
}
