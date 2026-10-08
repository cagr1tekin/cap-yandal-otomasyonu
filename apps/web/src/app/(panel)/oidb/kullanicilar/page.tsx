import { LABELS, ROLES, type Role } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Badge, Card, CardTitle, Field, Input, Page, PageHero, Select, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { assignRoleAction, createUserAction, unassignRoleAction } from '@/lib/panel-actions';
import type { Program } from '@/lib/types';

export const metadata = { title: 'Kullanıcılar ve roller' };

interface UserRow {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  lastLoginAt: string | null;
  assignments: { id: string; role: Role; unitId: string | null; programId: string | null }[];
}

/** Yetkinin tek kaynağı: rol + kapsam (birim / program) atamaları (KARARLAR K-1). */
export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = '' } = await searchParams;
  const [users, units, programs] = await Promise.all([
    api<UserRow[]>('/users'),
    api<{ id: string; name: string }[]>('/units'),
    api<Program[]>('/programs'),
  ]);
  const unitName = (id: string | null) => units.find((u) => u.id === id)?.name;
  const programName = (id: string | null) => programs.find((p) => p.id === id)?.name;
  const filtered = users.filter((u) => !q || u.username.includes(q.toLowerCase()) || u.displayName.toLocaleLowerCase('tr').includes(q.toLocaleLowerCase('tr')));
  const noRole = users.filter((u) => u.assignments.length === 0);

  return (
    <>
      <PageHero
        title="Kullanıcılar ve roller"
        crumbs={['Yönetim']}
        subtitle="Kimlik doğrulama SSO'dadır; panelde ne yapılabileceğini burada atanan rol ve kapsam belirler."
      />
      <Page>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle>Rol ata</CardTitle>
            <ActionForm action={assignRoleAction}>
              <Field label="Kullanıcı adı">
                <Input name="username" required list="usernames" />
              </Field>
              <datalist id="usernames">
                {users.map((u) => (
                  <option key={u.id} value={u.username}>
                    {u.displayName}
                  </option>
                ))}
              </datalist>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Rol">
                  <Select name="role">
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {LABELS.role[r]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Birim" hint="Birim öğrenci işleri için">
                  <Select name="unitId" defaultValue="">
                    <option value="">—</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Program" hint="Bölüm başkanı / koordinatör için">
                  <Select name="programId" defaultValue="">
                    <option value="">—</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <SubmitButton size="sm">Ata</SubmitButton>
            </ActionForm>
          </Card>
          <Card>
            <CardTitle>Kullanıcı ekle</CardTitle>
            <ActionForm action={createUserAction}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Kullanıcı adı (SSO)">
                  <Input name="username" required pattern="[a-z0-9._-]+" />
                </Field>
                <Field label="E-posta">
                  <Input name="email" type="email" required />
                </Field>
              </div>
              <Field label="Ad soyad / unvan">
                <Input name="displayName" required />
              </Field>
              <SubmitButton size="sm" variant="outline">
                Ekle
              </SubmitButton>
            </ActionForm>
            {noRole.length > 0 && (
              <p className="mt-3 text-sm text-warn">
                Rolü atanmamış {noRole.length} kullanıcı: {noRole.map((u) => u.username).join(', ')}
              </p>
            )}
          </Card>
        </div>

        <Card>
          <CardTitle
            aside={
              <form className="flex gap-2">
                <Input name="q" defaultValue={q} placeholder="Ara" className="w-48" aria-label="Kullanıcı ara" />
              </form>
            }
          >
            Kullanıcılar ({filtered.length})
          </CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Kullanıcı</Th>
                <Th>Roller ve kapsam</Th>
                <Th>Son giriş</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <Td>
                    <p className="font-medium">{u.displayName}</p>
                    <p className="text-xs text-su-subtle">
                      {u.username} · {u.email}
                    </p>
                  </Td>
                  <Td>
                    {u.assignments.length === 0 ? (
                      <Badge tone="warn">Rol yok</Badge>
                    ) : (
                      <ul className="space-y-1">
                        {u.assignments.map((a) => (
                          <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge>{LABELS.role[a.role]}</Badge>
                            <span>{unitName(a.unitId) ?? programName(a.programId) ?? 'tüm kapsam'}</span>
                            <ActionForm action={unassignRoleAction} className="inline space-y-0">
                              <input type="hidden" name="id" value={a.id} />
                              <SubmitButton size="sm" variant="ghost" confirm={`${u.username} kullanıcısından ${LABELS.role[a.role]} rolü kaldırılsın mı?`}>
                                Kaldır
                              </SubmitButton>
                            </ActionForm>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Td>
                  <Td className="text-xs">{fmtDateTime(u.lastLoginAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </Page>
    </>
  );
}
