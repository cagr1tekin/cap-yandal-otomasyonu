import Link from 'next/link';
import { LABELS } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { ReasonAction } from '@/components/inline';
import { Badge, Card, CardTitle, Field, Input, Page, PageHero, Select, Table, Td, Th } from '@/components/ui';
import { accountStateAction, createStaffAction, inviteAction } from '@/lib/actions';
import { api } from '@/lib/api';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { getMe } from '@/lib/me';
import type { UserRow } from '@/lib/types';

export const metadata = { title: 'Hesaplar' };

/**
 * Hesaplar: koordinatör, öğrenci, bölüm başkanı. Hesapları koordinatör açar; kendi kendine kayıt yoktur.
 * Şifreyi kullanıcı e-postasına gelen tek kullanımlık bağlantıyla belirler (sistem şifre görmez).
 */
export default async function Accounts() {
  const [users, me] = await Promise.all([api<UserRow[]>('/users'), getMe()]);
  const coord = me?.role === 'KOORDINATOR';
  return (
    <>
      <PageHero title="Hesaplar" crumbs={['Yönetim']} subtitle="Öğrenci hesabı öğrenci eklenirken açılır. Personel hesaplarını buradan açın. Pasife alınan hesap giriş yapamaz; hesap silinmez." />
      <Page>
        {coord && (
          <Card>
            <CardTitle>Personel hesabı aç</CardTitle>
            <ActionForm action={createStaffAction}>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Kullanıcı adı">
                  <Input name="username" required pattern="[a-z0-9._-]+" />
                </Field>
                <Field label="Ad soyad / unvan">
                  <Input name="displayName" required />
                </Field>
                <Field label="E-posta">
                  <Input name="email" type="email" required />
                </Field>
                <Field label="Rol">
                  <Select name="role">
                    <option value="BOLUM_BASKANI">{LABELS.role.BOLUM_BASKANI} (yalnız izler)</option>
                    <option value="KOORDINATOR">{LABELS.role.KOORDINATOR}</option>
                  </Select>
                </Field>
              </div>
              <SubmitButton size="sm">Hesabı aç ve bağlantı gönder</SubmitButton>
            </ActionForm>
          </Card>
        )}
        <Card>
          <CardTitle>{users.length} hesap</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Hesap</Th>
                <Th>Rol</Th>
                <Th>Davet</Th>
                <Th>Son giriş</Th>
                <Th>Durum</Th>
                {coord && <Th />}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.active ? undefined : 'opacity-60'}>
                  <Td>
                    {u.student ? (
                      <Link href={`/ogrenciler/${u.student.studentNo}`} className="font-medium">
                        {u.displayName}
                      </Link>
                    ) : (
                      <span className="font-medium">{u.displayName}</span>
                    )}
                    <span className="block text-xs text-su-subtle">
                      {u.username} · {u.email}
                    </span>
                  </Td>
                  <Td>
                    <Badge>{LABELS.role[u.role]}</Badge>
                    {u.student && <span className="ml-1 text-xs">{LABELS.trackShort[u.student.track]}</span>}
                  </Td>
                  <Td className="text-xs">{u.invitedAt ? fmtDate(u.invitedAt) : <Badge tone="warn">Gönderilmedi</Badge>}</Td>
                  <Td className="text-xs">{fmtDateTime(u.lastLoginAt)}</Td>
                  <Td>{u.active ? <Badge tone="ok">Etkin</Badge> : <Badge tone="muted">Pasif</Badge>}</Td>
                  {coord && (
                    <Td>
                      <div className="flex flex-col items-start gap-1.5">
                        {u.active && (
                          <ActionForm action={inviteAction} className="space-y-0">
                            <input type="hidden" name="username" value={u.username} />
                            <SubmitButton size="sm" variant="ghost">
                              {u.invitedAt ? 'Bağlantıyı yeniden gönder' : 'Bağlantı gönder'}
                            </SubmitButton>
                          </ActionForm>
                        )}
                        {u.id !== me?.id && (
                          <ReasonAction action={accountStateAction} fields={{ id: u.id, op: u.active ? 'deactivate' : 'activate' }} label={u.active ? 'Pasife al' : 'Etkinleştir'} />
                        )}
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </Page>
    </>
  );
}
