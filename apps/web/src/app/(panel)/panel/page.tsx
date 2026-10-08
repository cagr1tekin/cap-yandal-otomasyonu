import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { LABELS } from '@cap/contracts';
import { Badge, Card, Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import { termLabel } from '@/lib/format';
import { getMe } from '@/lib/me';
import type { Task, Term } from '@/lib/types';

export const metadata = { title: 'Pano' };

/** Rol bazlı pano: kullanıcının o an yapması gereken işler, sayılarıyla. */
export default async function Dashboard() {
  const [me, data] = await Promise.all([getMe(), api<{ tasks: Task[]; term: Term | null }>('/me/tasks')]);
  const student = me?.role === 'OGRENCI';
  return (
    <>
      <PageHero
        title={`Merhaba, ${me?.displayName ?? ''}`}
        crumbs={[student ? 'Yapılacaklar' : 'Pano', data.term ? termLabel(data.term) : '']}
        subtitle={
          <>
            {me ? LABELS.role[me.role] : ''}
            {me?.studentNo && ` · ${me.studentNo}`}
            {me?.role === 'BOLUM_BASKANI' && ' · yalnızca izleme yetkisi'}
          </>
        }
        actions={
          student ? (
            <Link href={`/ogrenciler/${me!.studentNo}`} className="rounded-pill bg-su-accent px-4 py-2 text-sm font-medium text-su-primary-dark no-underline">
              Durumum
            </Link>
          ) : undefined
        }
      />
      <Page>
        {data.tasks.length === 0 ? (
          <Card className="flex items-center gap-3">
            <CheckCircle2 aria-hidden className="size-8 text-ok" />
            <div>
              <h2 className="text-lg">Bekleyen işiniz yok.</h2>
              <p className="text-sm text-su-muted">Yeni bir iş geldiğinde burada ve bildirimlerde görünecek.</p>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.tasks.map((t) => (
              <Link key={t.key} href={t.link} className="group no-underline">
                <Card className="flex h-full items-start justify-between gap-3 p-5 transition-colors group-hover:border-su-primary">
                  <div>
                    <p className="font-semibold text-su-heading">{t.title}</p>
                    <p className="mt-1 text-sm text-su-muted">{t.detail}</p>
                    <p className="mt-3 inline-flex items-center gap-1 text-sm text-su-primary">
                      Git <ArrowRight aria-hidden className="size-4" />
                    </p>
                  </div>
                  <Badge tone="accent" className="text-base">
                    {t.count}
                  </Badge>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </Page>
    </>
  );
}
