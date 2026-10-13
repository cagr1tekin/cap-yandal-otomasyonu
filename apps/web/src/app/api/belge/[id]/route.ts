import { NextResponse, type NextRequest } from 'next/server';
import { API_BASE, currentUser } from '@/lib/auth';

/** Yüklenen belgeyi API üzerinden aktarır; erişim yetkisi API'de denetlenir. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL('/giris', req.url));
  const { id } = await params;
  const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(id)}/file`, { headers: { authorization: `Bearer ${user.accessToken}` }, cache: 'no-store' });
  if (!res.ok) return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  return new NextResponse(res.body, {
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'content-disposition': res.headers.get('content-disposition') ?? 'inline',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      'cache-control': 'private, no-store',
    },
  });
}
