import { NextResponse, type NextRequest } from 'next/server';
import { currentUser } from '@/lib/auth';

/** Öğrenci işlerinin OBİS'e gireceği ÇAP / yan dal ders listesi (CSV). */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL('/giris', req.url));
  const term = req.nextUrl.searchParams.get('donem') ?? '';
  const res = await fetch(`${process.env.API_URL}/course-registrations/export?termId=${encodeURIComponent(term)}`, {
    headers: { authorization: `Bearer ${user.accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  return new NextResponse(res.body, {
    headers: {
      'content-type': res.headers.get('content-type') ?? 'text/csv',
      'content-disposition': res.headers.get('content-disposition') ?? 'attachment',
    },
  });
}
