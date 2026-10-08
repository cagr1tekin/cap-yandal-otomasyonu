import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import {
  ApprovalDecisionSchema,
  CompleteSchema,
  CourseRegistrationSaveSchema,
  ExemptionCreateSchema,
  GradeEntrySchema,
  LeaveSchema,
  ProtocolCreateSchema,
  TermRecordSchema,
  WithdrawSchema,
} from '@cap/contracts';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { ZodPipe } from '../common/http';
import { FormsService } from '../forms/forms.service';
import { EnrollmentsService } from './enrollments.service';

@Controller()
export class EnrollmentsController {
  constructor(
    private readonly enrollments: EnrollmentsService,
    private readonly forms: FormsService,
    private readonly access: AccessService,
  ) {}

  @Get('enrollments')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  async list(@CurrentUser() user: AuthUser, @Query('type') type?: string, @Query('status') status?: string, @Query('q') q?: string) {
    await this.access.assertDepartmentStaff(user);
    return this.enrollments.list({ type, status, q });
  }

  @Get('me/enrollments')
  @Roles('OGRENCI')
  mine(@CurrentUser() user: AuthUser) {
    return this.enrollments.mine(user);
  }

  @Get('main-department/students')
  @Roles('DANISMAN', 'BOLUM_BASKANI')
  mainDepartment(@CurrentUser() user: AuthUser) {
    return this.enrollments.forMainDepartment(user);
  }

  @Get('enrollments/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.enrollments.detail(user, id);
  }

  @Post('enrollments/:id/withdrawal')
  @Roles('OGRENCI', 'KOORDINATOR')
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(WithdrawSchema)) body: { reason: string }) {
    return this.enrollments.withdraw(user, id, body.reason);
  }

  @Post('enrollments/:id/leaves')
  @Roles('KOORDINATOR')
  leave(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(LeaveSchema)) body: z.infer<typeof LeaveSchema>) {
    return this.enrollments.addLeave(user, id, body.termId, body.reason, body.note);
  }

  @Put('enrollments/:id/advisor')
  @Roles('KOORDINATOR')
  advisor(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ username: z.string().trim().nullable() }))) body: { username: string | null }) {
    return this.enrollments.setAdvisor(user, id, body.username || null);
  }

  @Put('enrollments/:id/term-record')
  @Roles('OGRENCI', 'KOORDINATOR')
  termRecord(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(TermRecordSchema)) body: z.infer<typeof TermRecordSchema>) {
    return this.enrollments.saveTermRecord(user, id, body);
  }

  @Post('term-records/:id/verify')
  @Roles('KOORDINATOR')
  verifyTermRecord(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.enrollments.verifyTermRecord(user, id);
  }

  @Post('enrollments/:id/complete')
  @Roles('KOORDINATOR')
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(CompleteSchema)) body: z.infer<typeof CompleteSchema>) {
    return this.enrollments.complete(user, id, body.mainGano);
  }

  // ---- Kabul ve Ders Protokolü ----

  @Put('enrollments/:id/protocol')
  @Roles('KOORDINATOR')
  createProtocol(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ProtocolCreateSchema)) body: z.infer<typeof ProtocolCreateSchema>) {
    return this.forms.createProtocol(user, id, body.itemIds);
  }

  @Post('enrollments/:id/protocol/submit')
  @Roles('KOORDINATOR')
  submitProtocol(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.forms.submitProtocol(user, id);
  }

  // ---- Dönemlik ders kayıt formu (FORM01) ----

  @Put('enrollments/:id/course-registration')
  @Roles('OGRENCI', 'KOORDINATOR')
  saveCourseReg(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(CourseRegistrationSaveSchema)) body: z.infer<typeof CourseRegistrationSaveSchema>) {
    return this.forms.saveCourseRegistration(user, id, body.termId, body.items);
  }

  @Post('enrollments/:id/course-registration/submit')
  @Roles('OGRENCI', 'KOORDINATOR')
  submitCourseReg(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(z.object({ termId: z.string().min(1) }))) body: { termId: string }) {
    return this.forms.submitCourseRegistration(user, id, body.termId);
  }

  @Put('enrollments/:id/grades')
  @Roles('KOORDINATOR')
  grades(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(GradeEntrySchema)) body: z.infer<typeof GradeEntrySchema>) {
    return this.forms.saveGrades(user, id, body.grades);
  }

  // ---- Özel şartlı derslerin muafiyeti ----

  @Post('enrollments/:id/exemptions')
  @Roles('OGRENCI', 'KOORDINATOR')
  exemption(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ExemptionCreateSchema)) body: z.infer<typeof ExemptionCreateSchema>) {
    return this.forms.createExemption(user, id, body);
  }

  // ---- İmzalar ----

  @Get('approvals/mine')
  mine2(@CurrentUser() user: AuthUser) {
    return this.forms.myApprovals(user);
  }

  @Post('approvals/:id')
  decide(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(ApprovalDecisionSchema)) body: { decision: 'APPROVED' | 'REJECTED'; comment?: string }) {
    return this.forms.decide(user, id, body.decision, body.comment);
  }
}
