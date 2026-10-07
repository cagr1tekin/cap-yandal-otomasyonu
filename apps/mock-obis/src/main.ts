import 'reflect-metadata';
import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Header,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD, NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { PROGRAMS, type SeedStudent } from '@cap/seed-data';
import { store } from './store';

const API_KEY = process.env.MOCK_OBIS_API_KEY ?? 'mock-obis-dev-key';
const PORT = Number(process.env.MOCK_OBIS_PORT ?? 4100);

/** /obis (sahte OBİS ekranı) ve /health dışındaki uçlar x-api-key ister. */
@Injectable()
class ApiKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (req.path === '/health' || req.path.startsWith('/obis')) return true;
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

  @Get('registrations')
  registered(@Query('studentNo') studentNo: string, @Query('programId') programId: string) {
    return { registered: store.registrations.has(`${studentNo}:${programId}`) };
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

  // ---- Sahte OBİS ekranı: öğrencinin kesin kaydı OBİS'te yaptığını taklit eder ----

  @Get('obis')
  @Header('content-type', 'text/html; charset=utf-8')
  page(@Query('ok') ok?: string) {
    const options = PROGRAMS.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
    return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sahte OBİS — Kesin Kayıt</title>
<style>body{font-family:system-ui,sans-serif;background:#f6f8fc;margin:0;color:#212529}
header{background:#555;color:#fff;padding:14px 20px;font-weight:600}
main{max-width:520px;margin:32px auto;background:#fff;border:1px solid #cbd5e1;border-radius:12px;padding:24px}
label{display:block;margin:12px 0 4px;font-size:14px}input,select{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px;box-sizing:border-box}
button{margin-top:16px;padding:10px 18px;border:0;border-radius:8px;background:#333;color:#fff;font-size:15px;cursor:pointer}
.ok{background:#e7f6ec;border:1px solid #9bd3ad;padding:10px;border-radius:8px}.note{font-size:13px;color:#475569}</style></head>
<body><header>SAHTE OBİS — yalnızca geliştirme/test</header><main>
<h1 style="font-size:20px;margin-top:0">Çift ana dal / yan dal kesin kaydı</h1>
${ok ? '<p class="ok">Kesin kayıt OBİS\'e işlendi.</p>' : ''}
<p class="note">Gerçek sistemde bu adım OBİS'te yapılır. ÇAP/Yan Dal sistemi kaydı OBİS'ten okur.</p>
<form method="post" action="/obis/kayit">
<label for="s">Öğrenci numarası</label><input id="s" name="studentNo" required pattern="[0-9]{9}">
<label for="p">Program</label><select id="p" name="programId">${options}</select>
<button type="submit">Kesin kaydı tamamla</button></form></main></body></html>`;
  }

  @Post('obis/kayit')
  register(@Body() body: { studentNo: string; programId: string }, @Res() res: Response) {
    must(store.get(body.studentNo), 'Öğrenci');
    store.registrations.add(`${body.studentNo}:${body.programId}`);
    res.redirect(303, '/obis?ok=1');
  }
}

@Module({ controllers: [ObisController], providers: [{ provide: APP_GUARD, useClass: ApiKeyGuard }] })
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn', 'log'] });
  app.useBodyParser('urlencoded', { extended: false });
  await app.listen(PORT, '127.0.0.1');
  console.log(`Sahte OBİS http://localhost:${PORT}`);
}
void bootstrap();
