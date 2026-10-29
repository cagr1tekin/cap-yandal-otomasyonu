import type { NextAuthOptions } from 'next-auth';
import { decode, type JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import { cookies } from 'next/headers';
import { WAKING } from './waking';

/** API kökü; ortam değişkeni sonu /api/v1 olmadan girilse de tamamlanır. */
export const API_BASE = (() => {
  const raw = (process.env.API_URL ?? 'http://127.0.0.1:4000/api/v1').trim().replace(/\/+$/, '');
  return raw.endsWith('/api/v1') ? raw : `${raw}/api/v1`;
})();

/** Uyuyan sunucu (ücretsiz barındırma) uyanırken beklenecek en uzun süre. */
const WAKE_BUDGET_MS = 50_000;

/**
 * Oturum açmadan çağrılan API uçları (giriş, şifre belirleme). API uyanırken barındırma katmanının döndürdüğü
 * yanıtlar (bağlantı hatası, 502/503/504, API'nin kendisinden gelmeyen 429) süre dolana kadar yeniden denenir;
 * API'nin kendi yanıtları (application/problem+json) olduğu gibi döner.
 */
export async function publicApi<T>(path: string, json: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; detail: string }> {
  const deadline = Date.now() + WAKE_BUDGET_MS;
  for (;;) {
    let res: Response | null = null;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(json),
        signal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
      });
    } catch {
      res = null;
    }
    const fromApi = res?.headers.get('content-type')?.includes('json') ?? false;
    const transient = !res || [502, 503, 504].includes(res.status) || (res.status === 429 && !fromApi);
    if (transient) {
      if (Date.now() + 3_000 < deadline) {
        await new Promise((r) => setTimeout(r, 3_000));
        continue;
      }
      return { ok: false, status: 503, detail: WAKING };
    }
    const body = await res!.json().catch(() => ({}));
    if (res!.ok) return { ok: true, data: body as T };
    const detail = res!.status === 429 ? 'Bu hesapla çok fazla deneme yapıldı. Bir dakika sonra tekrar deneyin.' : (body.detail ?? body.errors?.[0]?.message ?? body.title ?? 'İşlem yapılamadı.');
    return { ok: false, status: res!.status, detail };
  }
}

interface LoginResult {
  accessToken: string;
  expiresIn: number;
  username: string;
  displayName: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      credentials: { username: { type: 'text' }, password: { type: 'password' } },
      async authorize(credentials) {
        if (!credentials?.username || !credentials.password) return null;
        const r = await publicApi<LoginResult>('/auth/login', { username: credentials.username, password: credentials.password });
        // Hata ayrıntısı giriş sayfasına ?error= ile taşınır.
        if (!r.ok) throw new Error(r.detail);
        return { id: r.data.username, name: r.data.displayName, username: r.data.username, accessToken: r.data.accessToken, expiresAt: Math.floor(Date.now() / 1000) + r.data.expiresIn };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/giris', error: '/giris' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { username: string; accessToken: string; expiresAt: number };
        return { ...token, username: u.username, accessToken: u.accessToken, expiresAt: u.expiresAt };
      }
      return token;
    },
    // Erişim belirteci istemciye gönderilmez; rol veritabanındadır (API /me).
    async session({ session, token }) {
      return { ...session, user: { ...session.user, username: token.username as string } };
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
  accessToken: string;
}

export async function currentUser(): Promise<SessionUser | null> {
  const t = await readToken();
  if (!t?.accessToken) return null;
  if (typeof t.expiresAt === 'number' && Date.now() / 1000 > t.expiresAt) return null;
  return {
    username: t.username as string,
    name: (t.name as string) ?? (t.username as string),
    accessToken: t.accessToken as string,
  };
}
