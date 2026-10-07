import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  OfferingInputSchema,
  OfferingPatchSchema,
  TRACK_TYPES,
  WindowInputSchema,
  type OfferingInput,
  type WindowInput,
} from '@cap/contracts';
import type { TrackType } from '@cap/rules';
import { z } from 'zod';
import { CurrentUser, Public, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { ZodPipe } from '../common/http';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from './catalog.service';

const STAFF = ['KOORDINATOR', 'BOLUM_BASKANI', 'BIRIM', 'OIDB'] as const;

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
  @Get('units')
  units() {
    return this.prisma.unit.findMany({ orderBy: { name: 'asc' } });
  }

  @Public()
  @Get('programs')
  programs() {
    return this.prisma.program.findMany({ include: { unit: true }, orderBy: [{ unit: { name: 'asc' } }, { name: 'asc' }] });
  }

  @Public()
  @Get('programs/:id/courses')
  courses(@Param('id') id: string) {
    return this.prisma.programCourse.findMany({ where: { programId: id }, orderBy: [{ semester: 'asc' }, { code: 'asc' }] });
  }

  @Get('offerings')
  @Roles(...STAFF)
  list(@CurrentUser() user: AuthUser, @Query('termId') termId?: string, @Query('type') type?: string) {
    const t = z.enum(TRACK_TYPES).optional().parse(type || undefined) as TrackType | undefined;
    return this.catalog.listForStaff(user, { termId, type: t });
  }

  @Get('offerings/:id')
  @Roles(...STAFF)
  async get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const o = await this.catalog.getOffering(id);
    this.access.assertOffering(user, o, [...STAFF]);
    const window = await this.catalog.window(o.program.unitId, o.termId, o.type);
    return { ...o, window, warnings: await this.catalog.configurationWarnings(o) };
  }

  @Post('offerings')
  @Roles('BOLUM_BASKANI', 'BIRIM', 'OIDB')
  create(@Body(new ZodPipe(OfferingInputSchema)) body: OfferingInput, @CurrentUser() user: AuthUser) {
    return this.catalog.create(body, user);
  }

  @Patch('offerings/:id')
  @Roles('BOLUM_BASKANI', 'BIRIM', 'OIDB')
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(OfferingPatchSchema)) body: z.infer<typeof OfferingPatchSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.update(id, body, user);
  }

  @Get('windows')
  @Roles('BIRIM', 'OIDB')
  windows(@CurrentUser() user: AuthUser, @Query('termId') termId: string) {
    return this.catalog.windows(user, termId);
  }

  @Put('units/:unitId/windows')
  @Roles('BIRIM', 'OIDB')
  upsertWindow(
    @Param('unitId') unitId: string,
    @Body(new ZodPipe(WindowInputSchema)) body: WindowInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.upsertWindow(unitId, body, user);
  }

  @Post('units/:unitId/windows/close-now')
  @Roles('BIRIM', 'OIDB')
  closeNow(
    @Param('unitId') unitId: string,
    @Body(new ZodPipe(z.object({ termId: z.string(), type: z.enum(TRACK_TYPES) }))) body: { termId: string; type: TrackType },
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.closeWindowNow(unitId, body.termId, body.type, user);
  }
}
