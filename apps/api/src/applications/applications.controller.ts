import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { ApplySchema, VerifySchema, WithdrawSchema } from '@cap/contracts';
import type { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { ZodPipe } from '../common/http';
import { ApplicationsService } from './applications.service';

@Controller()
export class ApplicationsController {
  constructor(
    private readonly apps: ApplicationsService,
    private readonly access: AccessService,
  ) {}

  @Get('me/eligibility')
  @Roles('OGRENCI')
  eligibility(@CurrentUser() user: AuthUser) {
    return this.apps.eligibility(user);
  }

  @Get('me/applications')
  @Roles('OGRENCI')
  mine(@CurrentUser() user: AuthUser) {
    return this.apps.mine(user);
  }

  @Post('applications')
  @Roles('OGRENCI')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ApplySchema)) body: z.infer<typeof ApplySchema>, @Ip() ip: string) {
    return this.apps.create(user, body.offeringId, ip);
  }

  @Get('applications')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  async list(
    @CurrentUser() user: AuthUser,
    @Query('termId') termId?: string,
    @Query('offeringId') offeringId?: string,
    @Query('status') status?: string,
    @Query('verification') verification?: string,
    @Query('q') q?: string,
  ) {
    await this.access.assertDepartmentStaff(user);
    return this.apps.list({ termId, offeringId, status, verification, q });
  }

  @Get('applications/:id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.apps.get(user, id);
  }

  @Post('applications/:id/verify')
  @Roles('KOORDINATOR')
  verify(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(VerifySchema)) body: z.infer<typeof VerifySchema>) {
    return this.apps.verify(user, id, body.status, body.note);
  }

  @Post('applications/:id/withdraw')
  @Roles('OGRENCI', 'KOORDINATOR')
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(WithdrawSchema)) body: { reason: string }) {
    return this.apps.withdraw(user, id, body.reason);
  }
}
