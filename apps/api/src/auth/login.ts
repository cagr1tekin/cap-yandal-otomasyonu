import { Body, Controller, HttpCode, Inject, Post, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { badRequest, forbidden, ZodPipe } from '../common/http';
import { APP_CONFIG, type AppConfig } from '../config';
import { IdentityPort } from '../identity/identity';
import { PrismaService } from '../prisma/prisma.service';
import { LocalTokenVerifier, Public, SESSION_SECONDS } from './auth';
import { hashPassword, hashToken, verifyPassword } from './password';

const LoginSchema = z.object({ username: z.string().trim().min(1).max(64), password: z.string().min(1).max(128) });
const SetPasswordSchema = z.object({
  token: z.string().min(20).max(100),
  password: z.string().min(10, 'Şifre en az 10 karakter olmalı.').max(128),
});
const ForgotSchema = z.object({ username: z.string().trim().min(1).max(64) });

/** Kullanıcı yokken de aynı sürede yanıt vermek için kullanılan sahte özet (kullanıcı adı taraması). */
const DUMMY_HASH = hashPassword('kullanici-yok');

/** Giriş, şifre belirleme ve şifre yenileme isteği. Kendi kendine kayıt yoktur; hesapları koordinatör açar. */
@Public()
@Controller('auth')
export class LoginController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: LocalTokenVerifier,
    private readonly identity: IdentityPort,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async login(@Body(new ZodPipe(LoginSchema)) body: z.infer<typeof LoginSchema>) {
    const user = await this.prisma.user.findUnique({ where: { username: body.username } });
    const ok = await verifyPassword(body.password, user?.passwordHash ?? (await DUMMY_HASH));
    if (!user || !user.passwordHash || !ok) throw new UnauthorizedException('Kullanıcı adı ya da şifre hatalı.');
    if (!user.active) throw forbidden('Hesabınız pasif durumda.');
    return { accessToken: await this.tokens.issue(user), expiresIn: SESSION_SECONDS, username: user.username, displayName: user.displayName };
  }

  @Post('password')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async setPassword(@Body(new ZodPipe(SetPasswordSchema)) body: z.infer<typeof SetPasswordSchema>) {
    const user = await this.prisma.user.findUnique({ where: { resetTokenHash: hashToken(body.token) } });
    if (!user || !user.resetExpiresAt || user.resetExpiresAt < new Date()) throw badRequest('Bağlantı geçersiz ya da süresi dolmuş. Koordinatörden yeni bağlantı isteyin.');
    if (!user.active) throw forbidden('Hesabınız pasif durumda.');
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.password), resetTokenHash: null, resetExpiresAt: null } });
    return { ok: true, username: user.username };
  }

  /** Hesap varsa e-postasına yeni bağlantı gider; hesabın olup olmadığı yanıttan anlaşılmaz. */
  @Post('forgot')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async forgot(@Body(new ZodPipe(ForgotSchema)) body: z.infer<typeof ForgotSchema>) {
    // E-posta kapalıyken bağlantı yalnızca koordinatörün ekranında üretilir.
    if (!this.config.MAIL_ENABLED) return { ok: true, mail: false };
    const user = await this.prisma.user.findUnique({ where: { username: body.username } });
    if (user?.active) await this.identity.invite(user.username).catch(() => undefined);
    return { ok: true, mail: true };
  }
}
