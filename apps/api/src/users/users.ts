import { Body, Controller, Get, Injectable, Param, Post } from '@nestjs/common';
import { ReasonSchema, StaffCreateSchema } from '@cap/contracts';
import type { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AuditService } from '../audit/audit.service';
import { conflict, notFound, ZodPipe } from '../common/http';
import { IdentityPort } from '../identity/identity';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from '../students/students';

/**
 * Hesaplar. Üç giriş türü vardır; hesapları koordinatör açar, öğrenci kendi kendine kayıt olamaz.
 * Kullanıcı şifresini e-postasına gelen tek kullanımlık bağlantıyla belirler.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityPort,
    private readonly audit: AuditService,
    private readonly students: StudentsService,
  ) {}

  list() {
    return this.prisma.user.findMany({
      select: { id: true, username: true, displayName: true, email: true, role: true, active: true, invitedAt: true, lastLoginAt: true, createdAt: true, createdBy: true, student: { select: { studentNo: true, track: true, status: true } } },
      orderBy: [{ role: 'asc' }, { username: 'asc' }],
    });
  }

  async createStaff(user: AuthUser, input: z.infer<typeof StaffCreateSchema>) {
    if (await this.prisma.user.findFirst({ where: { OR: [{ username: input.username }, { email: input.email }] } })) throw conflict('Bu kullanıcı adı ya da e-posta zaten kayıtlı.');
    await this.identity.ensure(input);
    const u = await this.prisma.user.create({ data: { ...input, createdBy: user.username } });
    await this.audit.log(user, { action: 'ACCOUNT_CREATE', entity: 'User', entityId: u.id, after: input });
    const { link } = await this.students.invite(user, u.username);
    return { ...u, inviteLink: link };
  }

  async setActive(user: AuthUser, id: string, active: boolean, reason: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw notFound('Hesap');
    if (u.id === user.id) throw conflict('Kendi hesabınızı pasife alamazsınız.');
    if (!active && u.role === 'KOORDINATOR' && (await this.prisma.user.count({ where: { role: 'KOORDINATOR', active: true } })) <= 1) {
      throw conflict('Son etkin koordinatör hesabı pasife alınamaz.');
    }
    await this.identity.setEnabled(u.username, active);
    await this.prisma.user.update({ where: { id }, data: { active } });
    await this.audit.log(user, { action: active ? 'ACCOUNT_ACTIVATE' : 'ACCOUNT_DEACTIVATE', entity: 'User', entityId: id, before: { active: u.active }, after: { active }, reason });
    return { ok: true };
  }
}

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly students: StudentsService,
  ) {}

  @Get()
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  list() {
    return this.users.list();
  }

  @Post()
  @Roles('KOORDINATOR')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(StaffCreateSchema)) body: z.infer<typeof StaffCreateSchema>) {
    return this.users.createStaff(user, body);
  }

  @Post(':username/invite')
  @Roles('KOORDINATOR')
  invite(@CurrentUser() user: AuthUser, @Param('username') username: string) {
    return this.students.invite(user, username);
  }

  @Post(':id/deactivate')
  @Roles('KOORDINATOR')
  deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ReasonSchema)) body: { reason: string }) {
    return this.users.setActive(user, id, false, body.reason);
  }

  @Post(':id/activate')
  @Roles('KOORDINATOR')
  activate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ReasonSchema)) body: { reason: string }) {
    return this.users.setActive(user, id, true, body.reason);
  }
}
