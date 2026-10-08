import Link from 'next/link';
import { COURSE_KINDS, LABELS, type ReviewStatus, type TrackType } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ReviewBadge } from '@/components/status';
import { Badge, buttonVariants, Card, CardTitle, Empty, Field, Input, Page, PageHero, Select, Table, Td, Th } from '@/components/ui';
import { courseAction, reviewCourseRequestAction } from '@/lib/actions';
import { api } from '@/lib/api';
import { cn, fmtDate } from '@/lib/format';
import { getMe } from '@/lib/me';
import type { Course } from '@/lib/types';

export const metadata = { title: 'Ders kataloğu' };

interface CourseRequest {
  id: string;
  studentNo: string;
  student: { fullName: string; track: TrackType };
  code: string | null;
  name: string;
  note: string;
  status: ReviewStatus;
  createdAt: string;
  reviewNote: string | null;
  courseCode: string | null;
}

function CourseFields({ c }: { c?: Course }) {
  return (
    <div className="grid gap-3 sm:grid-cols-5">
      {!c && (
        <Field label="Kod">
          <Input name="code" required pattern="[A-Za-z0-9]{3,12}" />
        </Field>
      )}
      <Field label="Ders adı">
        <Input name="name" required defaultValue={c?.name} />
      </Field>
      <Field label="AKTS">
        <Input name="ects" type="number" min={0} max={60} required defaultValue={c?.ects} />
      </Field>
      <Field label="Kredi (isteğe bağlı)">
        <Input name="credit" type="number" min={0} max={20} defaultValue={c?.credit ?? ''} />
      </Field>
      <Field label="Yarıyıl">
        <Input name="semester" type="number" min={1} max={8} required defaultValue={c?.semester} />
      </Field>
      <Field label="Tür">
        <Select name="kind" defaultValue={c?.kind ?? 'ZORUNLU'}>
          {COURSE_KINDS.map((k) => (
            <option key={k} value={k}>
              {LABELS.courseKind[k]}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

/** Bölümün ders kataloğu. Öğrenci dersleri yalnız buradan seçer; koordinatör ekler, günceller, pasife alır. */
export default async function Catalog({ searchParams }: { searchParams: Promise<{ q?: string; sekme?: string }> }) {
  const { q, sekme } = await searchParams;
  const me = await getMe();
  const coord = me?.role === 'KOORDINATOR';
  const staff = me?.role !== 'OGRENCI';
  const tab = staff && sekme === 'talepler' ? 'talepler' : 'katalog';
  const [courses, requests] = await Promise.all([
    api<Course[]>(`/courses?${new URLSearchParams({ ...(q ? { q } : {}), ...(staff ? { all: '1' } : {}) })}`),
    tab === 'talepler' ? api<CourseRequest[]>('/course-requests') : Promise.resolve([] as CourseRequest[]),
  ]);

  return (
    <>
      <PageHero title="Ders kataloğu" crumbs={['Tanımlar']} subtitle="Bilgisayar Mühendisliği dersleri (Bologna ders paketi). Ders bilgisi değişse de öğrencilerin listeleri ve notları eklendikleri andaki bilgiyi korur." />
      {staff && (
        <nav aria-label="Katalog sekmeleri" className="border-b border-su-border/70 bg-white">
          <ul className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6">
            {[
              ['katalog', 'Dersler', '/katalog'],
              ['talepler', 'Ders talepleri', '/katalog?sekme=talepler'],
            ].map(([k, label, href]) => (
              <li key={k}>
                <Link href={href} aria-current={k === tab ? 'page' : undefined} className={cn('block border-b-2 px-3 py-3 text-sm font-medium no-underline', k === tab ? 'border-su-accent text-su-primary' : 'border-transparent text-su-muted')}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <Page>
        {tab === 'katalog' && (
          <>
            {coord && (
              <Card>
                <details>
                  <summary className="text-sm font-semibold text-su-primary">+ Kataloğa ders ekle</summary>
                  <ActionForm action={courseAction} className="mt-4">
                    <input type="hidden" name="mode" value="create" />
                    <CourseFields />
                    <SubmitButton size="sm">Ekle</SubmitButton>
                  </ActionForm>
                </details>
              </Card>
            )}
            <Card className="p-4">
              <form className="flex flex-wrap items-end gap-3" role="search">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Kod ya da ad</span>
                  <Input name="q" defaultValue={q ?? ''} className="w-64" />
                </label>
                <button className={buttonVariants({ variant: 'outline' })}>Ara</button>
              </form>
            </Card>
            <Card>
              <CardTitle>{courses.length} ders</CardTitle>
              <Table>
                <thead>
                  <tr>
                    <Th>Kod</Th>
                    <Th>Ders</Th>
                    <Th>AKTS</Th>
                    <Th>Yarıyıl</Th>
                    <Th>Tür</Th>
                    {coord && <Th />}
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c) => (
                    <tr key={c.code} className={c.active ? undefined : 'opacity-60'}>
                      <Td className="font-mono text-xs">{c.code}</Td>
                      <Td>
                        {c.name} {!c.active && <Badge tone="muted">Pasif</Badge>}
                      </Td>
                      <Td>{c.ects}</Td>
                      <Td>{c.semester}</Td>
                      <Td className="text-xs">{LABELS.courseKind[c.kind]}</Td>
                      {coord && (
                        <Td>
                          <details>
                            <summary className="text-xs font-medium text-su-primary">Düzenle</summary>
                            <ActionForm action={courseAction} className="mt-2 w-[min(90vw,48rem)] rounded-lg border border-su-border/70 bg-white p-3">
                              <input type="hidden" name="mode" value="update" />
                              <input type="hidden" name="code" value={c.code} />
                              <CourseFields c={c} />
                              <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" name="active" defaultChecked={c.active} /> Etkin (pasif ders yeni listelere eklenemez)
                              </label>
                              <Field label="Değişiklik gerekçesi">
                                <Input name="reason" required minLength={5} />
                              </Field>
                              <SubmitButton size="sm">Kaydet</SubmitButton>
                              <p className="text-[11px] text-su-subtle">
                                Son güncelleme {c.updatedBy} · {fmtDate(c.updatedAt)}
                              </p>
                            </ActionForm>
                          </details>
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
            {me?.role === 'OGRENCI' && (
              <p className="text-sm text-su-muted">
                Aradığınız ders katalogda yoksa <Link href={`/ogrenciler/${me.studentNo}?sekme=dersler`}>Derslerim</Link> sayfasından talep gönderebilirsiniz.
              </p>
            )}
          </>
        )}

        {tab === 'talepler' && (
          <Card>
            <CardTitle>Katalog dışı ders talepleri</CardTitle>
            {requests.length === 0 ? (
              <Empty>Talep yok.</Empty>
            ) : (
              <ul className="divide-y divide-su-border/60">
                {requests.map((r) => (
                  <li key={r.id} className="space-y-2 py-3 text-sm">
                    <p>
                      <Link href={`/ogrenciler/${r.studentNo}?sekme=dersler`} className="font-medium">
                        {r.student.fullName}
                      </Link>{' '}
                      ({r.studentNo}) · {fmtDate(r.createdAt)} · <ReviewBadge value={r.status} />
                    </p>
                    <p>
                      <span className="font-mono text-xs">{r.code ?? '—'}</span> {r.name} <span className="text-xs text-su-muted">· {r.note}</span>
                    </p>
                    {r.reviewNote && <p className="text-xs text-su-muted">Karar notu: {r.reviewNote}</p>}
                    {coord && r.status === 'PENDING' && (
                      <ActionForm action={reviewCourseRequestAction} className="flex flex-wrap items-end gap-2 space-y-0 rounded-lg bg-su-bg p-3">
                        <input type="hidden" name="id" value={r.id} />
                        <Field label="Katalogdaki ders kodu">
                          <Input name="courseCode" list="katalog-kodlari" defaultValue={courses.some((c) => c.code === r.code) ? (r.code ?? '') : ''} className="w-36" />
                        </Field>
                        <Field label="Not">
                          <Input name="note" className="w-64" />
                        </Field>
                        <label className="flex items-center gap-1 pb-2 text-xs">
                          <input type="checkbox" name="addToPlan" defaultChecked /> Öğrencinin listesine ekle
                        </label>
                        <SubmitButton size="sm" name="decision" value="APPROVED">
                          Onayla
                        </SubmitButton>
                        <SubmitButton size="sm" variant="outline" name="decision" value="REJECTED">
                          Reddet
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <datalist id="katalog-kodlari">
              {courses.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </datalist>
            {coord && <p className="mt-3 text-xs text-su-muted">Ders katalogda yoksa önce “Dersler” sekmesinden ekleyin, sonra talebi onaylayın.</p>}
          </Card>
        )}
      </Page>
    </>
  );
}
