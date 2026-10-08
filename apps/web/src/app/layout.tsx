import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import { Footer, Header } from '@/components/header';
import { getMe } from '@/lib/me';
import './globals.css';

const montserrat = Montserrat({ subsets: ['latin', 'latin-ext'], variable: '--font-montserrat', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'ÇAP / Yan Dal Yönetim Paneli — Selçuk Üniversitesi', template: '%s · ÇAP / Yan Dal Paneli' },
  description: 'Çift ana dal ve yan dal süreçleri için rol bazlı personel paneli (bitirme projesi).',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#1c458b' };

async function unreadCount(token: string): Promise<number> {
  try {
    const res = await fetch(`${process.env.API_URL}/notifications`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!res.ok) return 0;
    return ((await res.json()) as { unread: number }).unread;
  } catch {
    return 0;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const unread = me ? await unreadCount(me.accessToken) : 0;
  const user = me ? { username: me.username, name: me.displayName, roles: me.roles, accessToken: me.accessToken } : null;
  return (
    <html lang="tr" className={montserrat.variable}>
      <body className="flex min-h-dvh flex-col">
        <a href="#icerik" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          İçeriğe geç
        </a>
        <Header user={user} unread={unread} />
        <main id="icerik" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
