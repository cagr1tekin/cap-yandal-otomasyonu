import { Body, Controller, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import {
  ApprovalDecisionSchema,
  CourseRegistrationSaveSchema,
  FORM_STATUSES,
  LeaveSchema,
  ProtocolSaveSchema,
  WithdrawSchema,
  type LeaveReason,
} from '@cap/contracts';
import type { FormStatus } from '@prisma/client';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { ZodPipe } from '../common/http';
import { FormsService } from '../forms/forms.service';
import { EnrollmentsService } from './enrollments.service';

const STAFF = ['KOORDINATOR', 'DANISMAN', 'BOLUM_BASKANI', 'BIRIM', 'OIDB'] as const;

@Controller()
export class EnrollmentsController {
  constructor(
    private readonly enrollments: EnrollmentsService,
    private readonly forms: FormsService,
  ) {}

  @Get('enrollments/:id')
  @Roles(...STAFF)
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.enrollments.detail(user, id);
  }

  @Get('offerings/:id/enrollments')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI', 'BIRIM', 'OIDB')
  forOffering(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.enrollments.forOffering(user, id);
  }

  @Get('advisor/students')
  @Roles('DANISMAN', 'KOORDINATOR')
  advisor(@CurrentUser() user: AuthUser) {
    return this.enrollments.forAdvisor(user);
  }

  @Post('enrollments/:id/withdrawal')
  @Roles('BIRIM', 'OIDB')
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(WithdrawSchema)) body: { reason: string }) {
    return this.enrollments.withdraw(user, id, body.reason);
  }

  @Post('enrollments/:id/leaves')
  @Roles('BIRIM', 'OIDB')
  leave(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(LeaveSchema)) body: { termId: string; reason: LeaveReason; note?: string },
  ) {
    return this.enrollments.addLeave(user, id, body.termId, body.reason, body.note);
  }

  @Put('enrollments/:id/track-advisor')
  @Roles('BOLUM_BASKANI', 'BIRIM', 'OIDB')
  trackAdvisor(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ username: z.string().min(1) }))) body: { username: string }) {
    return this.enrollments.setTrackAdvisor(user, id, body.username);
  }

  // ---- Kabul ve Ders Protokolü ----

  @Put('enrollments/:id/protocol')
  @Roles('KOORDINATOR', 'OIDB')
  saveProtocol(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(ProtocolSaveSchema.extend({ reason: z.string().trim().max(1000).optional() }))) body: { courseCodes: string[]; reason?: string },
  ) {
    return this.forms.saveProtocol(user, id, body.courseCodes, body.reason);
  }

  @Post('enrollments/:id/protocol/submit')
  @Roles('KOORDINATOR', 'OIDB')
  submitProtocol(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.forms.submitProtocol(user, id);
  }

  @Post('enrollments/:id/protocol/file')
  @Roles('BIRIM', 'OIDB')
  fileProtocol(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.forms.fileProtocol(user, id);
  }

  // ---- Dönemlik ders kayıt formu ----

  @Put('enrollments/:id/course-registration')
  @Roles('KOORDINATOR', 'OIDB')
  saveCourseReg(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(CourseRegistrationSaveSchema)) body: { termId: string; courseCodes: string[] },
  ) {
    return this.forms.saveCourseRegistration(user, id, body.termId, body.courseCodes);
  }

  @Post('enrollments/:id/course-registration/submit')
  @Roles('KOORDINATOR', 'OIDB')
  submitCourseReg(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ termId: z.string().min(1) }))) body: { termId: string }) {
    return this.forms.submitCourseRegistration(user, id, body.termId);
  }

  @Post('course-registrations/submit-batch')
  @Roles('KOORDINATOR', 'OIDB')
  submitBatch(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(z.object({ termId: z.string().min(1), offeringIds: z.array(z.string()).optional() }))) body: { termId: string; offeringIds?: string[] },
  ) {
    return this.forms.submitBatch(user, body.termId, body.offeringIds);
  }

  @Get('course-registrations')
  @Roles('KOORDINATOR', 'BIRIM', 'OIDB')
  listCourseRegs(@CurrentUser() user: AuthUser, @Query('termId') termId: string, @Query('status') status?: string) {
    const st = status ? (z.enum(FORM_STATUSES).parse(status) as FormStatus) : undefined;
    return this.forms.listCourseRegistrations(user, termId, st);
  }

  @Post('course-registrations/mark-entered')
  @Roles('BIRIM', 'OIDB')
  markEntered(@CurrentUser() user: AuthUser, @Body(new ZodPipe(z.object({ ids: z.array(z.string()).min(1) }))) body: { ids: string[] }) {
    return this.forms.markEntered(user, body.ids);
  }

  @Get('course-registrations/export')
  @Roles('BIRIM', 'OIDB')
  async export(@CurrentUser() user: AuthUser, @Query('termId') termId: string, @Res() res: Response) {
    const csv = await this.forms.exportCourseRegistrations(user, termId);
    res
      .setHeader('content-type', 'text/csv; charset=utf-8')
      .setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(`OBIS ders kaydi ${termId}.csv`)}`)
      .send(csv);
  }

  // ---- Onaylar ----

  @Get('approvals/mine')
  @Roles(...STAFF)
  mine(@CurrentUser() user: AuthUser) {
    return this.forms.myApprovals(user);
  }

  @Post('approvals/:id')
  @Roles(...STAFF)
  decide(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(ApprovalDecisionSchema)) body: { decision: 'APPROVED' | 'REJECTED'; comment?: string },
  ) {
    return this.forms.decide(user, id, body.decision, body.comment);
  }
}
