import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { MinorPlanSchema, WithdrawalSchema } from '@cap/contracts';
import { CurrentUser, requireStudent, Roles, type AuthUser } from '../auth/auth';
import { ZodPipe } from '../common/http';
import { EnrollmentsService } from './enrollments.service';

@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Get('me/enrollments')
  @Roles('OGRENCI')
  mine(@CurrentUser() user: AuthUser) {
    return this.enrollments.mine(requireStudent(user));
  }

  @Put('enrollments/:id/minor-plan')
  @Roles('OGRENCI')
  savePlan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(MinorPlanSchema)) body: { poolCourseIds: string[] },
  ) {
    return this.enrollments.savePlan(requireStudent(user), id, body.poolCourseIds);
  }

  @Post('enrollments/:id/minor-plan/approve')
  @Roles('KOORDINATOR', 'OIDB')
  approvePlan(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.enrollments.approvePlan(user, id);
  }

  @Post('enrollments/:id/withdrawal')
  @Roles('OGRENCI')
  withdraw(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(WithdrawalSchema)) body: { reason: string },
  ) {
    return this.enrollments.withdraw(requireStudent(user), id, body.reason);
  }

  @Get('offerings/:id/enrollments')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI', 'BIRIM', 'OIDB')
  forOffering(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.enrollments.forOffering(user, id);
  }

  @Get('advisor/students')
  @Roles('DANISMAN')
  advisor(@CurrentUser() user: AuthUser) {
    return this.enrollments.forAdvisor(user);
  }
}
