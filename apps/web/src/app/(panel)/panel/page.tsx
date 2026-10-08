import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { LABELS } from '@cap/contracts';
import { Badge, Card, Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import { termLabel } from '@/lib/format';
import { getMe } from '@/lib/me';
import type { Task, Term } from '@/lib/types';

export const metadata = { title: 'Görevlerim' };

const roleTitle: Record<Task['role'], string> = { ...LABELS.role, IMZA: 'İmzalar' };

/** Rol bazlı pano: kullanıcının o an yapması gereken işler, sayılarıyla. */
export default async function Dashboard() {
  const [me, data] = await Promise.all([getMe(), api<{ tasks: Task[]; term: Term | null }>('/me/tasks')]);
  const groups = [...new Set(data.tasks.map((t) => t.role))];

  return (
    <>
      <PageHero
        title={`Merhaba, ${me?.displayName ?? ''}`}
        crumbs={['Görevlerim', data.term ? termLabel(data.term) : '']}
        subtitle={
          <>
            {me?.assignments.length ? 'Rolleriniz: ' : 'Öğrenci hesabı'}
            {me?.assignments.map((a, i) => (
              <span key={i} className="mr-1 inline-block rounded-pill bg-white/15 px-2 py-0.5 text-xs">
                {LABELS.role[a.role]}
                {a.programId ? ` · ${me.programs.find((p) => p.id === a.programId)?.name ?? a.programId}` : ''}
              </span>
            ))}
            {me?.studentNo && <span className="ml-1 inline-block rounded-pill bg-white/15 px-2 py-0.5 text-xs">{me.studentNo}</span>}
          </>
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
          groups.map((g) => (
            <section key={g} aria-labelledby={`g-${g}`} className="space-y-3">
              <h2 id={`g-${g}`} className="text-sm font-semibold uppercase tracking-[0.14em] text-su-muted">
                {roleTitle[g]}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {data.tasks
                  .filter((t) => t.role === g)
                  .map((t) => (
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
            </section>
          ))
        )}
      </Page>
    </>
  );
}
