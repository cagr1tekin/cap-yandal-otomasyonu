import Link from 'next/link';
import { LABELS, type TrackType } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Alert, Badge, Card, CardTitle, Field, Input, Page, PageHero, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { activateRuleSetAction, createRuleSetAction } from '@/lib/staff-actions';

export const metadata = { title: 'Kural setleri' };

interface Rule {
  id: string;
  code: string;
  kind: string;
  article: string;
  title: string;
  phase: string;
  params: Record<string, unknown>;
}

interface RuleSet {
  id: string;
  version: string;
  type: TrackType;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  effectiveFrom: string;
  note: string | null;
  createdBy: string | null;
  rules: Rule[];
  _count: { applications: number };
}

interface DryRun {
  total: number;
  changed: number;
  rows: { applicationId: string; studentNo: string; program: string; before: string; after: string; changed: boolean; failed: string[] }[];
}

const phaseLabel: Record<string, string> = {
  APPLICATION: 'Başvuru',
  TERM_END: 'Dönem sonu',
  GRADUATION: 'Mezuniyet',
  CONFIGURATION: 'Yapılandırma',
  PROTOCOL: 'Protokol',
};

const statusTone = { ACTIVE: 'ok', DRAFT: 'warn', RETIRED: 'muted' } as const;
const statusLabel = { ACTIVE: 'Etkin', DRAFT: 'Taslak', RETIRED: 'Emekli' } as const;

function numericParams(p: Record<string, unknown>) {
  return Object.entries(p).filter(([, v]) => typeof v === 'number') as [string, number][];
}

export default async function RuleSets({ searchParams }: { searchParams: Promise<{ deneme?: string }> }) {
  const { deneme } = await searchParams;
  const sets = await api<RuleSet[]>('/rule-sets');
  const dry = deneme ? await api<DryRun>(`/rule-sets/${deneme}/dry-run`, { method: 'POST' }) : null;
  const active = (type: TrackType) => sets.find((s) => s.type === type && s.status === 'ACTIVE');

  return (
    <>
      <PageHero
        title="Kural setleri"
        crumbs={['ÖİDB']}
        subtitle="Yönerge eşikleri koda değil sürümlü kural setlerine yazılır. Her başvuru değerlendirildiği sürümü saklar."
      />
      <Page>
        {dry && (
          <Card>
            <CardTitle>Deneme çalıştırması</CardTitle>
            <Alert tone={dry.changed ? 'warn' : 'ok'} title={`${dry.total} bekleyen başvurudan ${dry.changed} tanesinin sonucu değişir.`} />
            {dry.rows.length > 0 && (
              <Table className="mt-3">
                <thead>
                  <tr>
                    <Th>Öğrenci</Th>
                    <Th>Program</Th>
                    <Th>Şimdiki</Th>
                    <Th>Yeni sürümle</Th>
                    <Th>Sağlanmayan</Th>
                  </tr>
                </thead>
                <tbody>
                  {dry.rows.map((r) => (
                    <tr key={r.applicationId} className={r.changed ? 'bg-warn-soft/60' : undefined}>
                      <Td>{r.studentNo}</Td>
                      <Td>{r.program}</Td>
                      <Td>{r.before}</Td>
                      <Td>{r.after}</Td>
                      <Td className="text-xs">{r.failed.join('; ')}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        )}

        {sets.map((s) => (
          <Card key={s.id}>
            <CardTitle
              aside={
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone[s.status]}>{statusLabel[s.status]}</Badge>
                  {s.status === 'DRAFT' && (
                    <>
                      <Link href={`?deneme=${s.id}`} className="text-sm">
                        Deneme çalıştır
                      </Link>
                      <ActionForm action={activateRuleSetAction}>
                        <input type="hidden" name="id" value={s.id} />
                        <SubmitButton size="sm" confirm="Bu sürüm etkinleşecek ve önceki etkin sürüm emekliye ayrılacak. Devam edilsin mi?">
                          Etkinleştir
                        </SubmitButton>
                      </ActionForm>
                    </>
                  )}
                </div>
              }
            >
              {LABELS.track[s.type]} · {s.version}
              <span className="block text-xs font-normal text-su-muted">
                Yürürlük {fmtDate(s.effectiveFrom)} · {s._count.applications} başvuru bu sürümle değerlendirildi
                {s.note && ` · ${s.note}`}
              </span>
            </CardTitle>
            <details>
              <summary className="text-sm font-medium text-su-primary">{s.rules.length} kural</summary>
              <Table className="mt-3">
                <thead>
                  <tr>
                    <Th>Kod</Th>
                    <Th>Kural</Th>
                    <Th>Aşama</Th>
                    <Th>Dayanak</Th>
                    <Th>Parametreler</Th>
                  </tr>
                </thead>
                <tbody>
                  {s.rules.map((r) => (
                    <tr key={r.id}>
                      <Td className="font-mono text-xs">{r.code}</Td>
                      <Td>{r.title}</Td>
                      <Td>{phaseLabel[r.phase] ?? r.phase}</Td>
                      <Td className="text-xs">{r.article}</Td>
                      <Td className="font-mono text-xs">{JSON.stringify(r.params)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </details>
          </Card>
        ))}

        <Card>
          <CardTitle>Yeni sürüm (etkin setten türetilir)</CardTitle>
          {(['CAP', 'YANDAL'] as const).map((type) => {
            const base = active(type);
            if (!base) return null;
            return (
              <details key={type} className="mb-3 rounded-lg bg-su-bg px-3 py-2">
                <summary className="text-sm font-medium text-su-primary">
                  {LABELS.track[type]} — {base.version} temel alınarak
                </summary>
                <ActionForm action={createRuleSetAction} className="mt-3">
                  <input type="hidden" name="type" value={type} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Sürüm adı">
                      <Input name="version" required placeholder={`${type}-2027.1`} />
                    </Field>
                    <Field label="Yürürlük tarihi">
                      <Input name="effectiveFrom" type="date" required />
                    </Field>
                    <Field label="Not (senato kararı)">
                      <Input name="note" placeholder="Senato 2027-xx" />
                    </Field>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {base.rules.flatMap((r) =>
                      numericParams(r.params).map(([k, v]) => (
                        <Field key={`${r.code}:${k}`} label={`${r.code} · ${r.title} · ${k}`}>
                          <input type="hidden" name={`orig:${r.code}:${k}`} value={String(v)} />
                          <Input name={`p:${r.code}:${k}`} type="number" step="0.01" defaultValue={v} />
                        </Field>
                      )),
                    )}
                  </div>
                  <SubmitButton>Taslak oluştur</SubmitButton>
                </ActionForm>
              </details>
            );
          })}
        </Card>
      </Page>
    </>
  );
}
