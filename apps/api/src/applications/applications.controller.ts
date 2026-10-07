import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreateApplicationSchema, TRACK_TYPES, type CreateApplicationInput } from '@cap/contracts';
import { z } from 'zod';
import { CurrentUser, requireStudent, Roles, type AuthUser } from '../auth/auth';
import { ZodPipe } from '../common/http';
import { ApplicationsService } from './applications.service';

@Controller()
@Roles('OGRENCI')
export class ApplicationsController {
  constructor(private readonly apps: ApplicationsService) {}

  @Get('me/eligibility')
  eligibility(@CurrentUser() user: AuthUser, @Query('type') type = 'CAP') {
    return this.apps.eligibility(requireStudent(user), z.enum(TRACK_TYPES).parse(type));
  }

  @Get('me/applications')
  mine(@CurrentUser() user: AuthUser) {
    return this.apps.mine(requireStudent(user));
  }

  @Post('applications')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(CreateApplicationSchema)) body: CreateApplicationInput,
    @Ip() ip: string,
  ) {
    return this.apps.create(requireStudent(user), body, ip);
  }

  @Post('applications/:id/withdraw')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  withdraw(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.apps.withdraw(requireStudent(user), id);
  }
}
