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
import type { Role, StaffRole } from '@cap/contracts';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../config';
import { forbidden } from '../common/http';
import { PrismaService } from '../prisma/prisma.service';

export interface Assignment {
  role: StaffRole;
  programId: string | null;
}

export interface AuthUser {
  username: string;
  sub: string;
  displayName: string;
  email: string | null;
  /** Personel rolleri; hiç atama yoksa hesap öğrenci hesabıdır (['OGRENCI']). */
  roles: Role[];
  assignments: Assignment[];
  /** Öğrenci bilgilerini girdiyse öğrenci numarası. */
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

    let payload: JWTPayload & { preferred_username?: string; name?: string; email?: string };
    try {
      payload = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedException('Oturum geçersiz ya da süresi dolmuş.');
    }

    const username = payload.preferred_username;
    if (!username || !payload.sub) throw new UnauthorizedException('Belirteçte kullanıcı bilgisi yok.');
    // Keycloak yalnızca kimlik doğrular. Personel yetkisinin tek kaynağı bölüm başkanının yönettiği rol
    // atamalarıdır; ataması olmayan hesap öğrenci hesabıdır ve yalnızca kendi kayıtlarını görür.
    const user = await this.prisma.user.upsert({
      where: { username },
      create: { username, oidcSub: payload.sub, displayName: payload.name ?? username, email: payload.email ?? null, lastLoginAt: new Date() },
      update: { oidcSub: payload.sub, lastLoginAt: new Date() },
      include: { assignments: true, profile: { select: { studentNo: true } } },
    });

    const assignments = user.assignments.map((a) => ({ role: a.role as StaffRole, programId: a.programId }));
    const staffRoles = [...new Set(assignments.map((a) => a.role))] as Role[];
    req.user = {
      username,
      sub: payload.sub,
      displayName: user.displayName,
      email: user.email,
      roles: staffRoles.length ? staffRoles : ['OGRENCI'],
      assignments,
      studentNo: user.profile?.studentNo ?? null,
    };
    const roles = req.user.roles;

    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (required?.length && !required.some((r) => roles.includes(r))) throw forbidden();
    return true;
  }
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
