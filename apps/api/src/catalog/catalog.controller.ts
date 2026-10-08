import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { OfferingInputSchema, OfferingPatchSchema, TRACK_TYPES, YearStatSchema, type OfferingInput } from '@cap/contracts';
import type { TrackType } from '@cap/rules';
import { z } from 'zod';
import { CurrentUser, Public, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { ZodPipe } from '../common/http';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService, windowState } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  @Public()
  @Get('terms')
  terms() {
    return this.prisma.term.findMany({ orderBy: { startsAt: 'asc' } });
  }

  @Public()
  @Get('programs')
  programs() {
    return this.prisma.program.findMany({ orderBy: [{ isHome: 'desc' }, { name: 'asc' }] });
  }

  /** Bilgisayar Mühendisliği müfredatı (Bologna ders paketi). */
  @Public()
  @Get('courses')
  courses() {
    return this.prisma.course.findMany({ orderBy: [{ semester: 'asc' }, { code: 'asc' }] });
  }

  /** Açık teklifler: giriş yapmadan da görülebilir (kontenjan ilanı). */
  @Public()
  @Get('offerings/public')
  async publicOfferings() {
    const term = await this.catalog.currentTerm();
    const rows = term ? await this.catalog.list({ termId: term.id }) : [];
    return {
      term,
      offerings: rows
        .filter((o) => o.status === 'PUBLISHED')
        .map((o) => ({
          id: o.id,
          type: o.type,
          quota: o.quota,
          sourcePrograms: o.sourcePrograms.map((s) => s.program.name),
          window: windowState(o),
          registrationDeadline: o.registrationDeadline,
          waitlistDeadline: o.waitlistDeadline,
        })),
    };
  }

  @Get('offerings')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  async list(@CurrentUser() user: AuthUser, @Query('termId') termId?: string, @Query('type') type?: string) {
    await this.access.assertDepartmentStaff(user);
    const t = z.enum(TRACK_TYPES).optional().parse(type || undefined) as TrackType | undefined;
    const rows = await this.catalog.list({ termId, type: t });
    return rows.map((o) => ({ ...o, window: windowState(o) }));
  }

  @Get('offerings/:id')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  async get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.access.assertDepartmentStaff(user);
    const o = await this.catalog.getOffering(id);
    return { ...o, window: windowState(o), warnings: await this.catalog.configurationWarnings(o) };
  }

  @Post('offerings')
  @Roles('KOORDINATOR')
  create(@Body(new ZodPipe(OfferingInputSchema)) body: OfferingInput, @CurrentUser() user: AuthUser) {
    return this.catalog.create(body, user);
  }

  @Patch('offerings/:id')
  @Roles('KOORDINATOR')
  update(@Param('id') id: string, @Body(new ZodPipe(OfferingPatchSchema)) body: z.infer<typeof OfferingPatchSchema>, @CurrentUser() user: AuthUser) {
    return this.catalog.update(id, body, user);
  }

  @Post('offerings/:id/close-now')
  @Roles('KOORDINATOR')
  closeNow(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.catalog.closeNow(id, user);
  }

  @Get('year-stats')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  async yearStats(@CurrentUser() user: AuthUser) {
    await this.access.assertDepartmentStaff(user);
    return this.catalog.yearStats();
  }

  @Put('year-stats')
  @Roles('KOORDINATOR')
  upsertYearStat(@Body(new ZodPipe(YearStatSchema)) body: z.infer<typeof YearStatSchema>, @CurrentUser() user: AuthUser) {
    return this.catalog.upsertYearStat(body, user);
  }
}
