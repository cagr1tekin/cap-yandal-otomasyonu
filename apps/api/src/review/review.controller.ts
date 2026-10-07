import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { DecisionInputSchema, RankingOverrideSchema, RegistrationSchema, type Proposal } from '@cap/contracts';
import type { Response } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { ZodPipe } from '../common/http';
import { ReviewService } from './review.service';

@Controller()
export class ReviewController {
  constructor(private readonly review: ReviewService) {}

  @Get('offerings/:id/applications')
  @Roles('KOORDINATOR', 'BOLUM_BASKANI', 'BIRIM', 'OIDB')
  applications(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.review.applications(user, id);
  }

  @Patch('rankings/:applicationId')
  @Roles('KOORDINATOR', 'OIDB')
  override(
    @Param('applicationId') applicationId: string,
    @Body(new ZodPipe(RankingOverrideSchema)) body: { proposal: Proposal; reason: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.review.override(user, applicationId, body.proposal, body.reason);
  }

  @Post('offerings/:id/ranking/lock')
  @Roles('KOORDINATOR', 'OIDB')
  lock(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.review.lock(user, id);
  }

  @Get('decisions')
  @Roles('BIRIM', 'OIDB')
  overview(@CurrentUser() user: AuthUser, @Query('termId') termId?: string) {
    return this.review.decisionsOverview(user, termId);
  }

  @Post('offerings/:id/decision')
  @Roles('BIRIM', 'OIDB')
  decide(
    @Param('id') id: string,
    @Body(new ZodPipe(DecisionInputSchema)) body: { decisionDate: Date; decisionNo: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.review.decide(user, id, body.decisionDate, body.decisionNo);
  }

  @Post('offerings/:id/publish')
  @Roles('BIRIM', 'OIDB')
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.review.publish(user, id);
  }

  @Post('applications/:id/register')
  @Roles('BIRIM', 'OIDB')
  register(
    @Param('id') id: string,
    @Body(new ZodPipe(RegistrationSchema)) body: { documents: string[]; note?: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.review.register(user, id, body.documents, body.note);
  }

  @Post('offerings/:id/close-registration')
  @Roles('BIRIM', 'OIDB')
  closeRegistration(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.review.closeRegistration(user, id);
  }

  @Get('offerings/:id/export')
  @Roles('KOORDINATOR', 'BIRIM', 'OIDB')
  async export(
    @Param('id') id: string,
    @Query('format') format: string,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const f = z.enum(['csv', 'xlsx']).parse(format ?? 'csv');
    const file = await this.review.export(user, id, f);
    res
      .setHeader('content-type', file.type)
      .setHeader('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`)
      .send(file.body);
  }
}
