import { Body, Controller, Get, Injectable, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CourseSchema, CourseUpdateSchema, DEFAULT_SETTINGS, SettingsSchema, TermSchema, type CourseInput, type Settings } from '@cap/contracts';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AuditService } from '../audit/audit.service';
import { badRequest, conflict, notFound, ZodPipe } from '../common/http';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient | PrismaService;

/** Dönemler, bölümler, ders kataloğu ve sistem ayarları. */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  currentTerm() {
    return this.prisma.term.findFirst({ where: { isCurrent: true } });
  }

  async term(id: string) {
    const t = await this.prisma.term.findUnique({ where: { id } });
    if (!t) throw notFound('Dönem');
    return t;
  }

  /** Başlamış dönemler (eskiden yeniye). */
  startedTerms(now = new Date()) {
    return this.prisma.term.findMany({ where: { startsAt: { lte: now } }, orderBy: { startsAt: 'asc' } });
  }

  async createTerm(input: z.infer<typeof TermSchema>, user: AuthUser) {
    if (input.endsAt <= input.startsAt) throw badRequest('Dönem bitişi başlangıçtan sonra olmalı.');
    const id = `T-${input.year.slice(0, 4)}-${input.season}`;
    if (await this.prisma.term.findUnique({ where: { id } })) throw conflict('Bu dönem zaten tanımlı.');
    const t = await this.prisma.term.create({ data: { id, ...input } });
    await this.audit.log(user, { action: 'TERM_CREATE', entity: 'Term', entityId: id, after: input });
    return t;
  }

  async setCurrentTerm(id: string, user: AuthUser) {
    const before = await this.currentTerm();
    await this.term(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.term.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      await tx.term.update({ where: { id }, data: { isCurrent: true } });
      await this.audit.log(user, { action: 'TERM_SET_CURRENT', entity: 'Term', entityId: id, before: { current: before?.id } }, tx);
    });
    return { ok: true };
  }

  // ---------------- Ders kataloğu ----------------

  courses(q?: string, includeInactive = false) {
    const term = q?.trim();
    return this.prisma.course.findMany({
      where: {
        ...(includeInactive ? {} : { active: true }),
        ...(term ? { OR: [{ code: { contains: term, mode: 'insensitive' } }, { name: { contains: term, mode: 'insensitive' } }] } : {}),
      },
      orderBy: [{ semester: 'asc' }, { code: 'asc' }],
      take: 500,
    });
  }

  async course(code: string, tx: Tx = this.prisma) {
    const c = await tx.course.findUnique({ where: { code } });
    if (!c) throw notFound(`Katalogda ${code} kodlu ders`);
    return c;
  }

  /** Kataloğa ders ekler (elle giriş, aktarım ve ders talebi aynı yoldan geçer). */
  async createCourse(input: CourseInput, user: AuthUser, tx: Tx = this.prisma) {
    if (await tx.course.findUnique({ where: { code: input.code } })) throw conflict(`${input.code} kodlu ders katalogda zaten var.`);
    const c = await tx.course.create({ data: { ...input, credit: input.credit ?? null, updatedBy: user.username } });
    await this.audit.log(user, { action: 'COURSE_CREATE', entity: 'Course', entityId: c.code, after: input }, tx);
    return c;
  }

  /** Ders bilgisini günceller ya da pasife alır. Öğrenci listeleri ve geçmiş kayıtlar eklendikleri andaki bilgiyi saklar. */
  async updateCourse(code: string, input: z.infer<typeof CourseUpdateSchema>, user: AuthUser, tx: Tx = this.prisma) {
    const before = await this.course(code, tx);
    const { reason, ...data } = input;
    const c = await tx.course.update({ where: { code }, data: { ...data, updatedBy: user.username } });
    await this.audit.log(user, { action: data.active === false ? 'COURSE_DEACTIVATE' : 'COURSE_UPDATE', entity: 'Course', entityId: code, before, after: data, reason }, tx);
    return c;
  }

  // ---------------- Ayarlar ----------------

  async settings(): Promise<Settings> {
    const rows = await this.prisma.setting.findMany();
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { ...DEFAULT_SETTINGS, ...stored } as Settings;
  }

  async updateSettings(input: z.infer<typeof SettingsSchema>, user: AuthUser) {
    const before = await this.settings();
    await this.prisma.$transaction(async (tx) => {
      for (const [key, value] of Object.entries(input)) {
        await tx.setting.upsert({ where: { key }, create: { key, value, updatedBy: user.username }, update: { value, updatedBy: user.username } });
      }
      await this.audit.log(user, { action: 'SETTINGS_UPDATE', entity: 'Setting', entityId: 'sistem', before, after: input }, tx);
    });
    return this.settings();
  }
}

@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('terms')
  terms() {
    return this.prisma.term.findMany({ orderBy: { startsAt: 'asc' } });
  }

  @Post('terms')
  @Roles('KOORDINATOR')
  createTerm(@CurrentUser() user: AuthUser, @Body(new ZodPipe(TermSchema)) body: z.infer<typeof TermSchema>) {
    return this.catalog.createTerm(body, user);
  }

  @Post('terms/:id/current')
  @Roles('KOORDINATOR')
  setCurrent(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.catalog.setCurrentTerm(id, user);
  }

  @Get('programs')
  programs() {
    return this.prisma.program.findMany({ orderBy: [{ isHome: 'desc' }, { name: 'asc' }] });
  }

  @Get('courses')
  courses(@CurrentUser() user: AuthUser, @Query('q') q?: string, @Query('all') all?: string) {
    return this.catalog.courses(q, all === '1' && user.role !== 'OGRENCI');
  }

  @Post('courses')
  @Roles('KOORDINATOR')
  createCourse(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CourseSchema)) body: CourseInput) {
    return this.catalog.createCourse(body, user);
  }

  @Patch('courses/:code')
  @Roles('KOORDINATOR')
  updateCourse(@CurrentUser() user: AuthUser, @Param('code') code: string, @Body(new ZodPipe(CourseUpdateSchema)) body: z.infer<typeof CourseUpdateSchema>) {
    return this.catalog.updateCourse(code.toUpperCase(), body, user);
  }

  @Get('settings')
  settings() {
    return this.catalog.settings();
  }

  @Put('settings')
  @Roles('KOORDINATOR')
  updateSettings(@CurrentUser() user: AuthUser, @Body(new ZodPipe(SettingsSchema)) body: z.infer<typeof SettingsSchema>) {
    return this.catalog.updateSettings(body, user);
  }
}
