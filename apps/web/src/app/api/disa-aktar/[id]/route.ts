import { NextResponse, type NextRequest } from 'next/server';
import { currentUser } from '@/lib/auth';

/** Kabul listesi dışa aktarma (US-22): API'ye belirteçle istek atıp dosyayı aktarır. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL('/giris', req.url));
  const { id } = await params;
  const format = req.nextUrl.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  const res = await fetch(`${process.env.API_URL}/offerings/${encodeURIComponent(id)}/export?format=${format}`, {
    headers: { authorization: `Bearer ${user.accessToken}` },
    cache: 'no-store',
  });
  if (!res.ok) return NextResponse.json(await res.json().catch(() => ({})), { status: res.status });
  return new NextResponse(res.body, {
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'content-disposition': res.headers.get('content-disposition') ?? 'attachment',
    },
  });
}
