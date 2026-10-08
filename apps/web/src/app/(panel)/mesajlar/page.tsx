import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LABELS, type TrackType } from '@cap/contracts';
import { Badge, Card, Empty, Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { getMe } from '@/lib/me';

export const metadata = { title: 'Mesajlar' };

interface Thread {
  studentNo: string;
  fullName: string;
  track: TrackType;
  last: { body: string; at: string; fromStudent: boolean } | null;
  unread: number;
}

/** Personel gelen kutusu: her öğrenci için tek konuşma. Öğrenci kendi kartındaki mesajlara yönlendirilir. */
export default async function Inbox() {
  const me = await getMe();
  if (me?.role === 'OGRENCI') redirect(`/ogrenciler/${me.studentNo}?sekme=mesajlar`);
  const threads = await api<Thread[]>('/messages/inbox');
  return (
    <>
      <PageHero title="Mesajlar" crumbs={['Öğrenci takibi']} subtitle="Öğrencilerle yazışmalar. Yeni yazışma başlatmak için öğrenci kartındaki Mesajlar sekmesini kullanın." />
      <Page>
        <Card className="p-0">
          {threads.length === 0 ? (
            <Empty>Henüz yazışma yok.</Empty>
          ) : (
            <ul className="divide-y divide-su-border/60">
              {threads.map((t) => (
                <li key={t.studentNo}>
                  <Link href={`/ogrenciler/${t.studentNo}?sekme=mesajlar`} className="flex items-start justify-between gap-3 px-5 py-4 no-underline hover:bg-su-bg">
                    <div className="min-w-0">
                      <p className="font-semibold text-su-heading">
                        {t.fullName} <span className="text-xs font-normal text-su-subtle">{t.studentNo} · {LABELS.trackShort[t.track]}</span>
                      </p>
                      {t.last && (
                        <p className="truncate text-sm text-su-muted">
                          {t.last.fromStudent ? '' : 'Siz: '}
                          {t.last.body}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-xs text-su-muted">
                      {t.last && fmtDateTime(t.last.at)}
                      {t.unread > 0 && (
                        <Badge tone="accent" className="mt-1 block">
                          {t.unread} yeni
                        </Badge>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Page>
    </>
  );
}
