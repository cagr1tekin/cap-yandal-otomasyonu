import type { NextAuthOptions } from 'next-auth';
import { decode, type JWT } from 'next-auth/jwt';
import KeycloakProvider from 'next-auth/providers/keycloak';
import { cookies } from 'next/headers';
import type { Role } from '@cap/contracts';

const issuer = process.env.KEYCLOAK_ISSUER!;

function rolesOf(accessToken: string): Role[] {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString());
    return (payload.realm_access?.roles ?? []) as Role[];
  } catch {
    return [];
  }
}

async function refresh(token: JWT): Promise<JWT> {
  try {
    const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken as string,
        client_id: process.env.KEYCLOAK_CLIENT_ID!,
        client_secret: process.env.KEYCLOAK_CLIENT_SECRET!,
      }),
    });
    const t = await res.json();
    if (!res.ok) throw t;
    return {
      ...token,
      accessToken: t.access_token,
      refreshToken: t.refresh_token ?? token.refreshToken,
      idToken: t.id_token ?? token.idToken,
      expiresAt: Math.floor(Date.now() / 1000) + t.expires_in,
      roles: rolesOf(t.access_token),
    };
  } catch {
    return { ...token, error: 'RefreshFailed' };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer,
    }),
  ],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/giris' },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          idToken: account.id_token,
          expiresAt: account.expires_at,
          username: (profile as { preferred_username?: string })?.preferred_username,
          roles: rolesOf(account.access_token!),
        };
      }
      if (typeof token.expiresAt === 'number' && Date.now() / 1000 < token.expiresAt - 30) return token;
      return refresh(token);
    },
    // Erişim belirteci istemciye gönderilmez; yalnızca kimlik ve roller.
    async session({ session, token }) {
      return {
        ...session,
        user: { ...session.user, username: token.username as string, roles: (token.roles as Role[]) ?? [] },
        error: token.error,
      };
    },
  },
};

const COOKIE = process.env.NEXTAUTH_URL?.startsWith('https://') ? '__Secure-next-auth.session-token' : 'next-auth.session-token';

/** Sunucu tarafında oturum belirtecini çerezden çözer (istemciye açılmaz). */
export async function readToken(): Promise<JWT | null> {
  const jar = await cookies();
  // Büyük belirteçlerde next-auth çerezi parçalara böler: <ad>.0, <ad>.1 ...
  const raw =
    jar.get(COOKIE)?.value ??
    jar
      .getAll()
      .filter((c) => c.name.startsWith(`${COOKIE}.`))
      .sort((a, b) => Number(a.name.split('.').pop()) - Number(b.name.split('.').pop()))
      .map((c) => c.value)
      .join('');
  if (!raw) return null;
  try {
    return await decode({ token: raw, secret: process.env.NEXTAUTH_SECRET! });
  } catch {
    return null;
  }
}

export interface SessionUser {
  username: string;
  name: string;
  roles: Role[];
  accessToken: string;
}

export async function currentUser(): Promise<SessionUser | null> {
  const t = await readToken();
  if (!t?.accessToken || t.error) return null;
  if (typeof t.expiresAt === 'number' && Date.now() / 1000 > t.expiresAt) return null;
  return {
    username: t.username as string,
    name: (t.name as string) ?? (t.username as string),
    roles: (t.roles as Role[]) ?? [],
    accessToken: t.accessToken as string,
  };
}
