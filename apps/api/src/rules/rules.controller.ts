import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RuleSetCreateSchema } from '@cap/contracts';
import type { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { AccessService } from '../auth/access.service';
import { ZodPipe } from '../common/http';
import { RulesService } from './rules.service';

/** Kural setleri: komisyon yönerge değişikliğinde yeni sürüm üretir; bölüm başkanı görür. */
@Controller('rule-sets')
@Roles('KOORDINATOR', 'BOLUM_BASKANI')
export class RulesController {
  constructor(
    private readonly rules: RulesService,
    private readonly access: AccessService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    await this.access.assertDepartmentStaff(user);
    return this.rules.list();
  }

  @Post()
  @Roles('KOORDINATOR')
  create(@Body(new ZodPipe(RuleSetCreateSchema)) body: z.infer<typeof RuleSetCreateSchema>, @CurrentUser() user: AuthUser) {
    return this.rules.create(body, user);
  }

  @Post(':id/activate')
  @Roles('KOORDINATOR')
  activate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.rules.activate(id, user);
  }

  @Post(':id/dry-run')
  @Roles('KOORDINATOR')
  dryRun(@Param('id') id: string) {
    return this.rules.dryRun(id);
  }
}
