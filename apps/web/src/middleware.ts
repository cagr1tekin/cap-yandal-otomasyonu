import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';
import type { Role } from '@cap/contracts';

/** Yol → izin verilen roller. Son yetki denetimi her zaman API'dedir; bu yalnızca yönlendirmedir. */
const RULES: [string, Role[]][] = [
  ['/ogrenci', ['OGRENCI']],
  ['/koordinator', ['KOORDINATOR', 'OIDB']],
  ['/danisman', ['DANISMAN']],
  ['/birim/teklifler', ['BOLUM_BASKANI', 'BIRIM', 'OIDB']],
  ['/birim', ['BIRIM', 'OIDB']],
  ['/oidb', ['OIDB']],
  ['/raporlar', ['BIRIM', 'OIDB', 'BOLUM_BASKANI', 'KOORDINATOR']],
  ['/yazdir', ['BIRIM', 'OIDB', 'KOORDINATOR']],
  ['/bildirimler', ['OGRENCI', 'KOORDINATOR', 'DANISMAN', 'BOLUM_BASKANI', 'BIRIM', 'OIDB']],
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const rule = RULES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (!rule) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const expired = typeof token?.expiresAt === 'number' && Date.now() / 1000 > token.expiresAt;
  if (!token || expired || token.error) {
    const url = new URL('/giris', req.url);
    url.searchParams.set('donus', pathname);
    return NextResponse.redirect(url);
  }
  const roles = (token.roles as Role[]) ?? [];
  if (!rule[1].some((r) => roles.includes(r))) return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico).*)'],
};
