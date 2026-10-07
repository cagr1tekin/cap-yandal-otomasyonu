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
import { ROLES } from '@cap/contracts';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../config';
import { forbidden } from '../common/http';
import { PrismaService } from '../prisma/prisma.service';

export interface Assignment {
  role: Role;
  unitId: string | null;
  programId: string | null;
}

export interface AuthUser {
  username: string;
  sub: string;
  displayName: string;
  email: string | null;
  roles: Role[];
  assignments: Assignment[];
  /** Öğrenci rolünde öğrenci numarası (kullanıcı adı ile aynıdır). */
  studentNo: string | null;
}

const IS_PUBLIC = 'isPublic';
const ROLES_KEY = 'roles';

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest<Request & { user: AuthUser }>().user,
);

/** Belirteç doğrulayıcı; testlerde sahtesiyle değiştirilir. */
export abstract class TokenVerifier {
  abstract verify(token: string): Promise<JWTPayload>;
}

@Injectable()
export class OidcTokenVerifier extends TokenVerifier {
  private readonly jwks;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    super();
    this.jwks = createRemoteJWKSet(new URL(`${config.OIDC_ISSUER}/protocol/openid-connect/certs`));
  }

  async verify(token: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.config.OIDC_ISSUER,
      audience: this.config.OIDC_AUDIENCE,
    });
    return payload;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: TokenVerifier,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw new UnauthorizedException('Oturum açmanız gerekiyor.');

    let payload: JWTPayload & {
      preferred_username?: string;
      name?: string;
      email?: string;
      realm_access?: { roles?: string[] };
    };
    try {
      payload = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedException('Oturum geçersiz ya da süresi dolmuş.');
    }

    const username = payload.preferred_username;
    if (!username || !payload.sub) throw new UnauthorizedException('Belirteçte kullanıcı bilgisi yok.');
    const tokenRoles = (payload.realm_access?.roles ?? []).filter((r): r is Role =>
      (ROLES as readonly string[]).includes(r),
    );

    // Kullanıcı kaydı yoksa ilk girişte oluşturulur; kapsam atamaları yöneticiye bırakılır.
    const user = await this.prisma.user.upsert({
      where: { username },
      create: {
        username,
        oidcSub: payload.sub,
        displayName: payload.name ?? username,
        email: payload.email ?? null,
        lastLoginAt: new Date(),
        assignments: { create: tokenRoles.map((role) => ({ role })) },
      },
      update: { oidcSub: payload.sub, lastLoginAt: new Date() },
      include: { assignments: true },
    });

    const roles = [...new Set(tokenRoles)];
    req.user = {
      username,
      sub: payload.sub,
      displayName: user.displayName,
      email: user.email,
      roles,
      // Yalnızca belirteçte de bulunan roller için kapsam geçerlidir.
      assignments: user.assignments
        .filter((a) => roles.includes(a.role))
        .map((a) => ({ role: a.role, unitId: a.unitId, programId: a.programId })),
      studentNo: roles.includes('OGRENCI') ? username : null,
    };

    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (required?.length && !required.some((r) => roles.includes(r))) throw forbidden();
    return true;
  }
}

export function requireStudent(user: AuthUser): string {
  if (!user.studentNo) throw forbidden('Bu işlem yalnızca öğrenciler içindir.');
  return user.studentNo;
}

@Global()
@Module({
  providers: [
    { provide: TokenVerifier, useClass: OidcTokenVerifier },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [TokenVerifier],
})
export class AuthModule {}
