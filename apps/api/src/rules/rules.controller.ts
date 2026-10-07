import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RuleSetCreateSchema } from '@cap/contracts';
import type { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/auth';
import { ZodPipe } from '../common/http';
import { RulesService } from './rules.service';

@Controller('rule-sets')
@Roles('OIDB')
export class RulesController {
  constructor(private readonly rules: RulesService) {}

  @Get()
  list() {
    return this.rules.list();
  }

  @Post()
  create(@Body(new ZodPipe(RuleSetCreateSchema)) body: z.infer<typeof RuleSetCreateSchema>, @CurrentUser() user: AuthUser) {
    return this.rules.create(body, user);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.rules.activate(id, user);
  }

  @Post(':id/dry-run')
  dryRun(@Param('id') id: string) {
    return this.rules.dryRun(id);
  }
}
