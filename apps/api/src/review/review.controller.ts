import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { DecisionInputSchema, RankingOverrideSchema, type Proposal } from '@cap/contracts';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { ZodPipe } from '../common/http';
import { ReviewService } from './review.service';

@Controller()
export class ReviewController {
  constructor(
    private readonly review: ReviewService,
    private readonly access: AccessService,
  ) {}

  @Get('offerings/:id/applications')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  async applications(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.access.assertDepartmentStaff(user);
    return this.review.applications(id);
  }

  @Patch('rankings/:applicationId')
  @Roles('KOORDINATOR')
  override(@Param('applicationId') applicationId: string, @Body(new ZodPipe(RankingOverrideSchema)) body: { proposal: Proposal; reason: string }, @CurrentUser() user: AuthUser) {
    return this.review.override(user, applicationId, body.proposal, body.reason);
  }

  @Post('offerings/:id/ranking/lock')
  @Roles('KOORDINATOR')
  lock(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.review.lock(user, id);
  }

  @Post('offerings/:id/decision')
  @Roles('KOORDINATOR')
  decide(@Param('id') id: string, @Body(new ZodPipe(DecisionInputSchema)) body: { decisionDate: Date; decisionNo: string }, @CurrentUser() user: AuthUser) {
    return this.review.decide(user, id, body.decisionDate, body.decisionNo);
  }

  @Post('offerings/:id/publish')
  @Roles('KOORDINATOR')
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.review.publish(user, id);
  }

  @Post('applications/:id/accept')
  @Roles('OGRENCI')
  accept(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.review.accept(user, id);
  }

  @Post('offerings/:id/close-registration')
  @Roles('KOORDINATOR')
  closeRegistration(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.review.closeRegistration(user, id);
  }

  @Get('offerings/:id/result')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  async result(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.access.assertDepartmentStaff(user);
    return this.review.publicResult(id);
  }

  @Get('offerings/:id/export')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI')
  async export(@Param('id') id: string, @Query('format') format: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    await this.access.assertDepartmentStaff(user);
    const f = z.enum(['csv', 'xlsx']).parse(format ?? 'csv');
    const file = await this.review.export(id, f);
    res
      .setHeader('content-type', file.type)
      .setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`)
      .send(file.body);
  }
}
