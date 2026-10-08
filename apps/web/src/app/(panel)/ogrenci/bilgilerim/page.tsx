import Link from 'next/link';
import { APPLICATION_DOCUMENTS, DOCUMENT_KINDS, LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Alert, Badge, Card, CardTitle, Empty, Field, Input, Page, PageHero, Select, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { deleteDocumentAction, saveProfileAction, uploadDocumentAction } from '@/lib/actions';
import type { ProfileData } from '@/lib/types';

export const metadata = { title: 'Bilgilerim ve belgelerim' };

/**
 * Öğrenci akademik bilgilerini kendisi girer (OBİS bağlantısı yoktur, KARARLAR K-12).
 * Girilen değerler başvuruda yüklenen belgelerle komisyonca karşılaştırılır.
 */
export default async function Profile() {
  const d = await api<ProfileData>('/me/profile');
  const p = d.profile;
  const year = new Date().getFullYear();

  return (
    <>
      <PageHero
        title="Bilgilerim ve belgelerim"
        crumbs={['Öğrenci']}
        subtitle="Bilgilerinizi transkriptinizdeki ve YKS belgenizdeki değerlerle aynı girin. Komisyon başvurunuzu bu belgelerle karşılaştırır; uyuşmayan başvuru değerlendirilmez."
      />
      <Page>
        {!p && <Alert tone="info" title="Başvurabilmek için önce bilgilerinizi kaydedin." />}
        <Card>
          <CardTitle aside={p && <span className="text-xs text-su-muted">Son güncelleme {fmtDateTime(p.updatedAt)}</span>}>Öğrenci ve akademik bilgiler</CardTitle>
          <ActionForm action={saveProfileAction} className="space-y-5">
            <fieldset className="grid gap-3 sm:grid-cols-3">
              <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-su-muted">Kimlik</legend>
              <Field label="Öğrenci numarası" hint={p ? 'Kaydedildikten sonra değişmez' : '9 haneli'}>
                <Input name="studentNo" required inputMode="numeric" pattern="[0-9]{9}" defaultValue={p?.studentNo ?? (/^\d{9}$/.test(d.account.username) ? d.account.username : '')} readOnly={!!p} />
              </Field>
              <Field label="Ad soyad">
                <Input name="fullName" required defaultValue={p?.fullName ?? d.account.displayName} />
              </Field>
              <Field label="E-posta">
                <Input name="email" type="email" required defaultValue={p?.email ?? d.account.email ?? ''} />
              </Field>
              <Field label="Telefon (isteğe bağlı)">
                <Input name="phone" defaultValue={p?.phone ?? ''} />
              </Field>
            </fieldset>

            <fieldset className="grid gap-3 sm:grid-cols-3">
              <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-su-muted">Ana dal</legend>
              <Field label="Ana dal bölümü">
                <Select name="programId" required defaultValue={p?.programId ?? ''}>
                  <option value="" disabled>
                    Seçin
                  </option>
                  {d.programs.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} ({x.faculty})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kayıt yılı" hint="Ana dala yerleştiğiniz YKS yılı">
                <Input name="entryYear" type="number" required min={2015} max={year} defaultValue={p?.entryYear ?? ''} />
              </Field>
              <Field label="Başlayacağınız yarıyıl" hint="Başvuru döneminde okuyacağınız yarıyıl">
                <Input name="semesterNo" type="number" required min={1} max={12} defaultValue={p?.semesterNo ?? ''} />
              </Field>
              <Field label="Ana dal danışmanı" hint="Listede yoksa boş bırakın; koordinatör atar">
                <Select name="advisorUsername" defaultValue={p?.advisorUsername ?? ''}>
                  <option value="">—</option>
                  {d.advisors.map((a) => (
                    <option key={a.username} value={a.username}>
                      {a.displayName} · {d.programs.find((x) => x.id === a.programId)?.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </fieldset>

            <fieldset className="grid gap-3 sm:grid-cols-3">
              <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-su-muted">Başarı (transkriptten)</legend>
              <Field label="Genel not ortalaması (GNO)" hint="4,00 üzerinden">
                <Input name="gano" required inputMode="decimal" pattern="[0-4]([.,][0-9]{1,2})?" defaultValue={p ? p.gano.toFixed(2) : ''} />
              </Field>
              <Field label="Bugüne kadarki tüm dersler" hint="Alınması gereken derslerin tamamını alıp geçtiniz mi?">
                <Select name="completedAllCourses" defaultValue={p ? String(p.completedAllCourses) : 'true'}>
                  <option value="true">Hepsini aldım ve geçtim</option>
                  <option value="false">Almadığım ya da başarısız olduğum ders var</option>
                </Select>
              </Field>
              <div />
              <Field label="Sınıftaki başarı sıranız" hint="İlk %20 koşulu için; bilmiyorsanız boş bırakın">
                <Input name="classRank" type="number" min={1} defaultValue={p?.classRank ?? ''} />
              </Field>
              <Field label="Sınıf mevcudu">
                <Input name="classSize" type="number" min={1} defaultValue={p?.classSize ?? ''} />
              </Field>
              <div className="self-end text-sm text-su-muted">{p?.classRankPercentile != null && <>Sınıfınızda en üst %{String(p.classRankPercentile).replace('.', ',')} içindesiniz.</>}</div>
            </fieldset>

            <fieldset className="grid gap-3 sm:grid-cols-3">
              <legend className="mb-2 text-sm font-semibold uppercase tracking-wide text-su-muted">YKS (sonuç belgesinden)</legend>
              <Field label="Yerleştirme puanı" hint="Taban puan yolu için">
                <Input name="entryScore" inputMode="decimal" defaultValue={p?.entryScore ?? ''} />
              </Field>
              <Field label="Başarı sırası" hint="Mühendislikte başarı sırası şartı aranır">
                <Input name="successRank" type="number" min={1} defaultValue={p?.successRank ?? ''} />
              </Field>
            </fieldset>
            <SubmitButton>Bilgilerimi kaydet</SubmitButton>
          </ActionForm>
        </Card>

        <Card>
          <CardTitle>Belgelerim</CardTitle>
          {!p ? (
            <Empty>Belge yüklemek için önce bilgilerinizi kaydedin.</Empty>
          ) : (
            <>
              <ul className="mb-4 space-y-1 text-sm text-su-muted">
                {APPLICATION_DOCUMENTS.map((doc) => (
                  <li key={doc.key}>
                    <span className="font-medium text-su-heading">{doc.label}</span> <span className="text-xs">({doc.source})</span>
                  </li>
                ))}
                <li className="text-xs">Başvuru dilekçesini sistem üretir; ayrıca yüklemeniz gerekmez.</li>
              </ul>
              <ActionForm action={uploadDocumentAction} className="rounded-lg bg-su-bg p-3">
                <div className="grid gap-3 sm:grid-cols-[14rem_1fr_auto] sm:items-end">
                  <Field label="Belge türü">
                    <Select name="kind" defaultValue="YKS_BELGESI">
                      {DOCUMENT_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {LABELS.document[k]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Dosya" hint="PDF, JPG ya da PNG; en çok 5 MB">
                    <Input name="file" type="file" required accept="application/pdf,image/jpeg,image/png" />
                  </Field>
                  <SubmitButton pending="Yükleniyor…">Yükle</SubmitButton>
                </div>
              </ActionForm>
              {p.documents.length === 0 ? (
                <Empty>Henüz belge yüklemediniz.</Empty>
              ) : (
                <Table className="mt-4">
                  <thead>
                    <tr>
                      <Th>Tür</Th>
                      <Th>Dosya</Th>
                      <Th>Yüklenme</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {p.documents.map((doc) => (
                      <tr key={doc.id}>
                        <Td>{LABELS.document[doc.kind]}</Td>
                        <Td>
                          <a href={`/api/belge/${doc.id}`} target="_blank" rel="noreferrer">
                            {doc.fileName}
                          </a>{' '}
                          <span className="text-xs text-su-subtle">{Math.max(1, Math.round(doc.size / 1024))} KB</span>
                        </Td>
                        <Td className="text-xs">{fmtDateTime(doc.uploadedAt)}</Td>
                        <Td>
                          {doc._count?.applications ? (
                            <Badge tone="muted">Başvuruda kullanıldı</Badge>
                          ) : (
                            <ActionForm action={deleteDocumentAction} className="space-y-0">
                              <input type="hidden" name="id" value={doc.id} />
                              <SubmitButton size="sm" variant="ghost" confirm="Belge silinsin mi?">
                                Sil
                              </SubmitButton>
                            </ActionForm>
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
              <p className="mt-4 text-sm">
                Bilgiler ve belgeler tamamsa <Link href="/ogrenci/basvuru">başvuru sayfasına</Link> geçin.
              </p>
            </>
          )}
        </Card>
      </Page>
    </>
  );
}
