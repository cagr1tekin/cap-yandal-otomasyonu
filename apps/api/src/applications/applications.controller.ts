import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { IntakeApplicationSchema, TRACK_TYPES, WithdrawSchema, type IntakeApplicationInput } from '@cap/contracts';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { ZodPipe } from '../common/http';
import { ApplicationsService } from './applications.service';

@Controller()
export class ApplicationsController {
  constructor(private readonly apps: ApplicationsService) {}

  @Get('intake/candidates')
  @Roles('BIRIM', 'OIDB')
  candidates(@CurrentUser() user: AuthUser, @Query('studentNo') studentNo: string, @Query('type') type = 'CAP') {
    return this.apps.candidates(user, z.string().regex(/^\d{9}$/, 'Öğrenci numarası 9 haneli olmalı').parse(studentNo), z.enum(TRACK_TYPES).parse(type));
  }

  @Post('applications')
  @Roles('BIRIM', 'OIDB')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(IntakeApplicationSchema)) body: IntakeApplicationInput, @Ip() ip: string) {
    return this.apps.create(user, body, ip);
  }

  @Get('applications')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI', 'BIRIM', 'OIDB')
  list(
    @CurrentUser() user: AuthUser,
    @Query('termId') termId?: string,
    @Query('offeringId') offeringId?: string,
    @Query('status') status?: string,
    @Query('studentNo') studentNo?: string,
  ) {
    return this.apps.list(user, { termId, offeringId, status, studentNo });
  }

  @Get('applications/:id')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI', 'BIRIM', 'OIDB')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.apps.get(user, id);
  }

  @Post('applications/:id/withdraw')
  @Roles('BIRIM', 'OIDB')
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(WithdrawSchema)) body: { reason: string }) {
    return this.apps.withdraw(user, id, body.reason);
  }
}
