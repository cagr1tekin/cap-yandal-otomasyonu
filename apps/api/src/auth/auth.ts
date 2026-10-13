import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Global,
  Inject,
  Injectable,
  Module,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import type { Role } from '@cap/contracts';
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../config';
import { forbidden } from '../common/http';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: Role;
  /** Öğrenci hesabının öğrenci numarası */
  studentNo: string | null;
}

const IS_PUBLIC = 'isPublic';
const ROLES_KEY = 'roles';
const READ_ONLY_SAFE = 'readOnlySafe';

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
/** Bölüm başkanının da çağırabileceği, veri değiştirmeyen POST (ör. bildirimi okundu işaretleme). */
export const ReadOnlySafe = () => SetMetadata(READ_ONLY_SAFE, true);
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user,
);

/** Belirteç doğrulayıcı; testlerde sahtesiyle değiştirilir. */
export abstract class TokenVerifier {
  abstract verify(token: string): Promise<JWTPayload>;
}

const ISSUER = 'cap-api';
const AUDIENCE = 'cap-web';
/** Oturum süresi; web tarafındaki oturumla aynı (8 saat). */
export const SESSION_SECONDS = 8 * 60 * 60;

/** API'nin kendi imzaladığı oturum belirteci (HS256, AUTH_SECRET). */
@Injectable()
export class LocalTokenVerifier extends TokenVerifier {
  private readonly key: Uint8Array;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super();
    this.key = new TextEncoder().encode(config.AUTH_SECRET);
  }

  async issue(user: { id: string; username: string }) {
    return new SignJWT({ preferred_username: user.username })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_SECONDS}s`)
      .sign(this.key);
  }

  async verify(token: string): Promise<JWTPayload> {
    // Yalnızca HS256 kabul edilir: "alg: none" ve algoritma karışıklığı saldırılarına karşı.
    const { payload } = await jwtVerify(token, this.key, { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] });
    return payload;
  }
}

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Kimlik doğrulama ve yetki. Belirteç yalnızca kimliği taşır; rol ve hesabın etkinliği her istekte veritabanından okunur.
 * Hesapları koordinatör açar: veritabanında olmayan ya da pasif hesap hiçbir işlem yapamaz.
 * Bölüm başkanı yalnızca izler: veri değiştiren her istek burada reddedilir.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: TokenVerifier,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Oturum açmanız gerekiyor.');

    let payload: JWTPayload & { preferred_username?: string };
    try {
      payload = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedException('Oturum geçersiz ya da süresi dolmuş.');
    }
    const username = payload.preferred_username;
    if (!username || !payload.sub) throw new UnauthorizedException('Belirteçte kullanıcı bilgisi yok.');

    const user = await this.prisma.user.findUnique({ where: { username }, include: { student: { select: { studentNo: true } } } });
    if (!user) throw forbidden('Hesabınız bu sistemde tanımlı değil. Hesapları ÇAP / YDP koordinatörü açar.');
    if (!user.active) throw forbidden('Hesabınız pasif durumda.');
    // Kimlik servisinde aynı kullanıcı adıyla yeniden açılmış başka bir hesap bu kaydı devralamaz.
    if (user.oidcSub && user.oidcSub !== payload.sub) throw new UnauthorizedException('Hesap eşleşmesi doğrulanamadı.');
    const stale = !user.lastLoginAt || Date.now() - user.lastLoginAt.getTime() > 5 * 60_000;
    if (!user.oidcSub || stale) {
      await this.prisma.user.update({ where: { id: user.id }, data: { oidcSub: payload.sub, lastLoginAt: new Date() } });
    }

    req.user = { id: user.id, username, displayName: user.displayName, email: user.email, role: user.role, studentNo: user.student?.studentNo ?? null };

    if (user.role === 'BOLUM_BASKANI' && !SAFE_METHODS.includes(req.method) && !this.reflector.getAllAndOverride<boolean>(READ_ONLY_SAFE, targets)) {
      throw forbidden('Bölüm başkanı hesabı yalnızca izleme yetkisine sahiptir.');
    }
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
    if (required?.length && !required.includes(user.role)) throw forbidden();
    return true;
  }
}

@Global()
@Module({
  providers: [
    LocalTokenVerifier,
    { provide: TokenVerifier, useExisting: LocalTokenVerifier },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [TokenVerifier, LocalTokenVerifier],
})
export class AuthModule {}
