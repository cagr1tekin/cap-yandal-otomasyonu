import 'reflect-metadata';
import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { SeedStudent } from '@cap/seed-data';
import { store } from './store';

const API_KEY = process.env.MOCK_OBIS_API_KEY ?? 'mock-obis-dev-key';
const PORT = Number(process.env.MOCK_OBIS_PORT ?? 4100);

/** /health dışındaki uçlar x-api-key ister. */
@Injectable()
class ApiKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (req.path === '/health') return true;
    if (req.header('x-api-key') !== API_KEY) throw new UnauthorizedException('Geçersiz API anahtarı');
    return true;
  }
}

function must<T>(v: T | undefined, what: string): T {
  if (v === undefined) throw new NotFoundException(`${what} bulunamadı`);
  return v;
}

@Controller()
class ObisController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('students/:no')
  student(@Param('no') no: string) {
    return must(store.student(no), 'Öğrenci');
  }

  @Get('students/:no/standing')
  standing(@Param('no') no: string) {
    return must(store.standing(no), 'Öğrenci');
  }

  @Get('students/:no/tracks/:programId')
  track(@Param('no') no: string, @Param('programId') programId: string) {
    return must(store.track(no, programId), 'Öğrenci');
  }

  @Get('programs/:id/base-score')
  baseScore(@Param('id') id: string, @Query('year') year: string) {
    return { programId: id, year: Number(year), baseScore: store.baseScore(id, Number(year)) };
  }

  @Post('osym/verify')
  verify(@Body() body: { docNo: string; verificationCode: string }) {
    return store.verifyOsym(body.docNo, body.verificationCode);
  }

  @Get('advisors/:username/students')
  advisees(@Param('username') username: string) {
    return { studentNos: store.advisees(username) };
  }

  /** Geliştirme: öğrenciyi bir senaryoya getirir, ör. { "gano": 2.49 } ya da { "track": {...} }. */
  @Post('_admin/scenario/:no')
  scenario(@Param('no') no: string, @Body() body: Partial<SeedStudent> & { track?: SeedStudent['tracks'][number] }) {
    const s = must(store.get(no), 'Öğrenci');
    const { track, ...rest } = body;
    Object.assign(s, rest);
    if (track) {
      s.tracks = [...s.tracks.filter((t) => t.programId !== track.programId), track];
    }
    return store.standing(no);
  }

  @Post('_admin/reset')
  reset() {
    store.reset();
    return { status: 'reset' };
  }

}

@Module({ controllers: [ObisController], providers: [{ provide: APP_GUARD, useClass: ApiKeyGuard }] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  await app.listen(PORT, '127.0.0.1');
  console.log(`Sahte OBİS http://localhost:${PORT}`);
}
void bootstrap();
