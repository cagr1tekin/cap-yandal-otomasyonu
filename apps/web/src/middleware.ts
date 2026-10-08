import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';
import type { Role } from '@cap/contracts';

/** Yol → izin verilen roller. Son yetki denetimi her zaman API'dedir; bu yalnızca yönlendirmedir. */
const ALL: Role[] = ['KOORDINATOR', 'DANISMAN', 'BOLUM_BASKANI', 'BIRIM', 'OIDB'];

/** Yalnızca giriş denetimi; rol yetkisi API'de (rol atamaları veritabanında olduğu için belirteçte değil). */
const RULES: [string, Role[]][] = [
  ['/panel', ALL],
  ['/onaylar', ALL],
  ['/kayitlar', ALL],
  ['/koordinator', ALL],
  ['/danisman', ALL],
  ['/birim', ALL],
  ['/oidb', ALL],
  ['/raporlar', ALL],
  ['/yazdir', ALL],
  ['/bildirimler', ALL],
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
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico).*)'],
};
