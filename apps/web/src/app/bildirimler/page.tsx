import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { SubmitButton } from '@/components/forms';
import { Badge, Card, Empty, Page, PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';

export const metadata = { title: 'Bildirimler' };

interface Note {
  id: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

async function readAll() {
  'use server';
  await api('/notifications/read-all', { method: 'POST' });
  revalidatePath('/', 'layout');
}

export default async function Notifications() {
  const data = await api<{ unread: number; items: Note[] }>('/notifications');
  return (
    <>
      <PageHero
        title="Bildirimler"
        subtitle={`${data.unread} okunmamış bildirim`}
        actions={
          data.unread > 0 ? (
            <form action={readAll}>
              <SubmitButton variant="accent" size="sm">
                Tümünü okundu say
              </SubmitButton>
            </form>
          ) : null
        }
      />
      <Page className="max-w-3xl">
        {data.items.length === 0 && <Empty>Bildiriminiz yok.</Empty>}
        <div className="space-y-3">
          {data.items.map((n) => (
            <Card key={n.id} className={n.readAt ? 'p-4 opacity-80' : 'border-l-4 border-l-su-accent p-4'}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-semibold">{n.title}</h2>
                {!n.readAt && <Badge tone="accent">Yeni</Badge>}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-su-muted">{n.body}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-su-subtle">
                <span>{fmtDateTime(n.createdAt)}</span>
                {n.link && <Link href={n.link}>Ayrıntı</Link>}
              </div>
            </Card>
          ))}
        </div>
      </Page>
    </>
  );
}
