import Link from 'next/link';
import { LABELS, STUDENT_STATUSES, TRACK_TYPES } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { StudentStatusBadge, WorstBadge } from '@/components/status';
import { Badge, buttonVariants, Card, CardTitle, Empty, Field, Input, Page, PageHero, Progress, Select, Table, Td, Th } from '@/components/ui';
import { createStudentAction } from '@/lib/actions';
import { api } from '@/lib/api';
import { termLabel } from '@/lib/format';
import { getMe } from '@/lib/me';
import type { Program, StudentRow, Term } from '@/lib/types';

export const metadata = { title: 'Öğrenciler' };

const flags = { onay: 'Onay bekleyen kaydı olan', uyari: 'Uyarısı olan', mezuniyet: 'Mezuniyete / sertifikaya hazır' } as const;

/** Bölüme gelen bütün ÇAP ve YDP öğrencileri; koordinatör kabul edilen öğrenciyi buradan ekler. */
export default async function Students({ searchParams }: { searchParams: Promise<{ q?: string; track?: string; status?: string; flag?: string }> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  const [rows, me, terms, programs] = await Promise.all([api<StudentRow[]>(`/students?${qs}`), getMe(), api<Term[]>('/terms'), api<Program[]>('/programs')]);
  const coord = me?.role === 'KOORDINATOR';
  const current = terms.find((t) => t.isCurrent);

  return (
    <>
      <PageHero title="Öğrenciler" crumbs={['Öğrenci takibi']} subtitle="Bölüme gelen ÇAP ve YDP öğrencileri. Başvuru ve seçim dekanlıktadır; kabul edilen öğrenciyi koordinatör ekler." />
      <Page>
        {coord && (
          <Card>
            <details>
              <summary className="text-sm font-semibold text-su-primary">+ Kabul edilen öğrenciyi ekle</summary>
              <ActionForm action={createStudentAction} className="mt-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Öğrenci numarası">
                    <Input name="studentNo" required inputMode="numeric" pattern="[0-9]{9}" />
                  </Field>
                  <Field label="Ad soyad">
                    <Input name="fullName" required />
                  </Field>
                  <Field label="Okul e-postası" hint="Şifre belirleme bağlantısı buraya gider">
                    <Input name="schoolEmail" type="email" required />
                  </Field>
                  <Field label="Kayıt türü (ÇAP / YDP)">
                    <Select name="track">
                      {TRACK_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {LABELS.track[t]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Kabul dönemi">
                    <Select name="admissionTermId" defaultValue={current?.id}>
                      {terms.map((t) => (
                        <option key={t.id} value={t.id}>
                          {termLabel(t)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Ana dal bölümü (isteğe bağlı)" hint="Ders listesi şablonu için">
                    <Select name="mainProgramId" defaultValue="">
                      <option value="">—</option>
                      {programs
                        .filter((p) => !p.isHome)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </Select>
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="sendInvite" defaultChecked /> Hesap şifre belirleme bağlantısını şimdi gönder (geriye dönük girişte kapatabilirsiniz)
                </label>
                <SubmitButton>Öğrenciyi ekle</SubmitButton>
              </ActionForm>
            </details>
          </Card>
        )}

        <Card className="p-4">
          <form className="flex flex-wrap items-end gap-3" role="search">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Ara</span>
              <Input name="q" defaultValue={sp.q ?? ''} placeholder="Numara ya da ad" className="w-48" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Program</span>
              <Select name="track" defaultValue={sp.track ?? ''} className="w-36">
                <option value="">Tümü</option>
                {TRACK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LABELS.trackShort[t]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Durum</span>
              <Select name="status" defaultValue={sp.status ?? ''} className="w-48">
                <option value="">Tümü</option>
                {STUDENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LABELS.studentStatus[s]}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">Süzgeç</span>
              <Select name="flag" defaultValue={sp.flag ?? ''} className="w-56">
                <option value="">—</option>
                {Object.entries(flags).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </label>
            <button className={buttonVariants({ variant: 'outline' })}>Süz</button>
          </form>
        </Card>

        <Card>
          <CardTitle>{rows.length} öğrenci</CardTitle>
          {rows.length === 0 ? (
            <Empty>Bu süzgece uyan öğrenci yok.</Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Öğrenci</Th>
                  <Th>Program</Th>
                  <Th>Kabul</Th>
                  <Th>İlerleme</Th>
                  <Th>Durum</Th>
                  <Th>Kural</Th>
                  <Th>Bekleyen</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.studentNo}>
                    <Td>
                      <Link href={`/ogrenciler/${s.studentNo}`} className="font-medium">
                        {s.fullName}
                      </Link>
                      <span className="block text-xs text-su-subtle">
                        {s.studentNo}
                        {s.mainProgram && ` · ${s.mainProgram}`}
                      </span>
                    </Td>
                    <Td>{LABELS.trackShort[s.track]}</Td>
                    <Td className="text-xs">{termLabel(s.admissionTerm)}</Td>
                    <Td className="min-w-40">
                      {s.totals.plannedEcts ? <Progress value={s.totals.completedEcts} max={s.totals.plannedEcts} label="AKTS" /> : <span className="text-xs text-su-subtle">Liste yok</span>}
                    </Td>
                    <Td>
                      <StudentStatusBadge value={s.status} />
                      {s.graduationReady && <Badge tone="accent" className="mt-1">{s.track === 'CAP' ? 'Mezuniyete hazır' : 'Sertifikaya hazır'}</Badge>}
                    </Td>
                    <Td>
                      <WorstBadge value={s.worst} />
                    </Td>
                    <Td className="text-xs">
                      {s.pending > 0 && <Badge tone="warn">{s.pending} onay</Badge>} {s.unread > 0 && <Badge tone="neutral">{s.unread} mesaj</Badge>}
                      {!s.account?.invitedAt && <Badge tone="muted">Davet yok</Badge>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </Page>
    </>
  );
}
