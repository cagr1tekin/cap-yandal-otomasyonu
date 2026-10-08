import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

/** Oturum gerektiren yollar. Rol yetkisi API'dedir (rol atamaları veritabanında olduğu için belirteçte değil). */
const PROTECTED = ['/panel', '/onaylar', '/bildirimler', '/belgeler', '/ogrenci', '/kayitlar', '/koordinator', '/ana-dal', '/yonetim', '/raporlar', '/yazdir'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return NextResponse.next();

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
