import { redirect } from 'next/navigation';
import { ALLOWED_UPLOAD_TYPES, HARD_UPLOAD_LIMIT_MB, type Settings } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Badge, Card, CardTitle, Field, Input, Page, PageHero, Select, Table, Td, Th } from '@/components/ui';
import { currentTermAction, settingsAction, termAction } from '@/lib/actions';
import { api } from '@/lib/api';
import { fmtDate, termLabel } from '@/lib/format';
import { getMe } from '@/lib/me';
import type { Term } from '@/lib/types';

export const metadata = { title: 'Dönemler ve ayarlar' };

/** Akademik dönemler ve sistem ayarları. Yönerge değerleri "Yönerge kuralları" sayfasındadır. */
export default async function SettingsPage() {
  const me = await getMe();
  if (me?.role !== 'KOORDINATOR') redirect('/panel');
  const [terms, settings] = await Promise.all([api<Term[]>('/terms'), api<Settings>('/settings')]);
  return (
    <>
      <PageHero title="Dönemler ve ayarlar" crumbs={['Tanımlar']} subtitle="Akademik dönemler, içinde bulunulan dönem ve dosya yükleme sınırları. Her değişiklik işlem kaydına yazılır." />
      <Page>
        <Card>
          <CardTitle>Akademik dönemler</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Dönem</Th>
                <Th>Başlangıç</Th>
                <Th>Bitiş</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.id}>
                  <Td className="font-medium">{termLabel(t)}</Td>
                  <Td>{fmtDate(t.startsAt)}</Td>
                  <Td>{fmtDate(t.endsAt)}</Td>
                  <Td>
                    {t.isCurrent ? (
                      <Badge tone="ok">İçinde bulunulan dönem</Badge>
                    ) : (
                      <ActionForm action={currentTermAction} className="space-y-0">
                        <input type="hidden" name="id" value={t.id} />
                        <SubmitButton size="sm" variant="ghost" confirm="Öğrenciler bundan sonra bu dönemin derslerini girecek. Devam edilsin mi?">
                          Bu dönemi başlat
                        </SubmitButton>
                      </ActionForm>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <ActionForm action={termAction} className="mt-4 rounded-lg bg-su-bg p-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Akademik yıl">
                <Input name="year" required pattern="\d{4}-\d{4}" placeholder="2027-2028" />
              </Field>
              <Field label="Yarıyıl">
                <Select name="season">
                  <option value="GUZ">Güz</option>
                  <option value="BAHAR">Bahar</option>
                </Select>
              </Field>
              <Field label="Başlangıç">
                <Input name="startsAt" type="date" required />
              </Field>
              <Field label="Bitiş">
                <Input name="endsAt" type="date" required />
              </Field>
            </div>
            <SubmitButton size="sm" variant="outline">
              Dönem ekle
            </SubmitButton>
          </ActionForm>
        </Card>
        <Card>
          <CardTitle>Belge ve mesaj ayarları</CardTitle>
          <ActionForm action={settingsAction}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="En büyük dosya boyutu (MB)" hint={`Sunucunun sabit üst sınırı ${HARD_UPLOAD_LIMIT_MB} MB`}>
                <Input name="uploadMaxMb" type="number" min={1} max={HARD_UPLOAD_LIMIT_MB} defaultValue={settings.uploadMaxMb} />
              </Field>
              <Field label="En uzun mesaj (karakter)">
                <Input name="messageMaxLength" type="number" min={200} max={20000} defaultValue={settings.messageMaxLength} />
              </Field>
            </div>
            <fieldset className="text-sm">
              <legend className="mb-1 font-medium text-su-heading">İzin verilen dosya türleri (içerikten denetlenir)</legend>
              {ALLOWED_UPLOAD_TYPES.map((t) => (
                <label key={t} className="mr-4 inline-flex items-center gap-1.5">
                  <input type="checkbox" name="uploadTypes" value={t} defaultChecked={settings.uploadTypes.includes(t)} /> {t.split('/')[1].toUpperCase()}
                </label>
              ))}
            </fieldset>
            <SubmitButton size="sm">Kaydet</SubmitButton>
          </ActionForm>
        </Card>
      </Page>
    </>
  );
}
