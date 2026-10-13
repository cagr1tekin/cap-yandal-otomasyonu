import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/** Çıkış: oturum çerezlerini siler ve ana sayfaya döner. */
export async function GET() {
  const res = NextResponse.redirect(new URL('/', process.env.NEXTAUTH_URL ?? 'http://localhost:3000'));
  const jar = await cookies();
  for (const c of jar.getAll()) {
    if (c.name.includes('next-auth')) res.cookies.delete(c.name);
  }
  return res;
}
