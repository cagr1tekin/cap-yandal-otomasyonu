import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RuleSetCreateSchema } from '@cap/contracts';
import type { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { ZodPipe } from '../common/http';
import { ChecksService } from './checks.service';
import { RulesService } from './rules.service';

/**
 * Yönerge kuralları: sayısal değerler sürümlü kural setindedir. Koordinatör yeni sürüm üretir, dener ve
 * etkinleştirir; eski sürüm ve onunla yapılmış kontroller kalır. Bölüm başkanı görür.
 */
@Controller()
export class RulesController {
  constructor(
    private readonly rules: RulesService,
    private readonly checks: ChecksService,
  ) {}

  @Get('rule-sets')
  list() {
    return this.rules.list();
  }

  @Post('rule-sets')
  @Roles('KOORDINATOR')
  create(@Body(new ZodPipe(RuleSetCreateSchema)) body: z.infer<typeof RuleSetCreateSchema>, @CurrentUser() user: AuthUser) {
    return this.rules.create(body, user);
  }

  @Post('rule-sets/:id/activate')
  @Roles('KOORDINATOR')
  activate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.rules.activate(id, user);
  }

  @Get('rule-sets/:id/dry-run')
  @Roles('KOORDINATOR')
  dryRun(@Param('id') id: string) {
    return this.checks.dryRun(id);
  }

  @Get('checks')
  overview() {
    return this.checks.overview();
  }

  @Post('checks/run-all')
  @Roles('KOORDINATOR')
  runAll(@CurrentUser() user: AuthUser) {
    return this.checks.runAll(user);
  }
}
