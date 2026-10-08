import { LABELS, STAFF_ROLES, type StaffRole } from '@cap/contracts';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Alert, Badge, Card, CardTitle, Field, Input, Page, PageHero, Select, Table, Td, Th } from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { assignRoleAction, createUserAction, unassignRoleAction } from '@/lib/actions';
import type { Program } from '@/lib/types';

export const metadata = { title: 'Kullanıcılar ve roller' };

interface StaffRow {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  lastLoginAt: string | null;
  assignments: { id: string; role: StaffRole; programId: string | null; program: { name: string } | null }[];
}

interface StudentRow {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  lastLoginAt: string | null;
  studentNo: string | null;
  mainProgramName: string | null;
}

/** Yetkinin tek kaynağı: rol + kapsam (bölüm) atamaları. Atamayı Bilgisayar Müh. bölüm başkanı yapar. */
export default async function Users() {
  const [data, programs] = await Promise.all([api<{ staff: StaffRow[]; students: StudentRow[]; canManage: boolean }>('/users'), api<Program[]>('/programs')]);
  const candidates = [...data.staff, ...data.students.filter((s) => !s.studentNo)];

  return (
    <>
      <PageHero
        title="Kullanıcılar ve roller"
        crumbs={['Yönetim']}
        subtitle="Kimlik doğrulama SSO'dadır; sistemde ne yapılabileceğini burada atanan rol ve bölüm belirler. Personel rolü olmayan hesap öğrenci hesabıdır."
      />
      <Page>
        {!data.canManage && <Alert tone="info" title="Rol atamasını yalnızca Bilgisayar Mühendisliği bölüm başkanı yapar; bu sayfayı salt okunur görüyorsunuz." />}
        {data.canManage && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardTitle>Rol ata</CardTitle>
              <ActionForm action={assignRoleAction}>
                <Field label="Kullanıcı adı">
                  <Input name="username" required list="usernames" />
                </Field>
                <datalist id="usernames">
                  {candidates.map((u) => (
                    <option key={u.id} value={u.username}>
                      {u.displayName}
                    </option>
                  ))}
                </datalist>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Rol">
                    <Select name="role">
                      {STAFF_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {LABELS.role[r]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Bölüm" hint="Bölüm başkanı ve danışman için zorunlu; koordinatör için boş">
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
              <CardTitle>Personel hesabı ekle</CardTitle>
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
              <p className="mt-3 text-xs text-su-muted">Ana dal danışmanının ya da bölüm başkanının hesabı yoksa imzası formda boş kalır ve ıslak imzayı koordinatör işler.</p>
            </Card>
          </div>
        )}
        <Card>
          <CardTitle>Personel ({data.staff.length})</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Kullanıcı</Th>
                <Th>Roller ve kapsam</Th>
                <Th>Son giriş</Th>
              </tr>
            </thead>
            <tbody>
              {data.staff.map((u) => (
                <tr key={u.id}>
                  <Td>
                    <p className="font-medium">{u.displayName}</p>
                    <p className="text-xs text-su-subtle">
                      {u.username} · {u.email}
                    </p>
                  </Td>
                  <Td>
                    <ul className="space-y-1">
                      {u.assignments.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge>{LABELS.role[a.role]}</Badge>
                          <span>{a.program?.name ?? 'Bilgisayar Mühendisliği ÇAP / yan dal komisyonu'}</span>
                          {data.canManage && (
                            <ActionForm action={unassignRoleAction} className="inline space-y-0">
                              <input type="hidden" name="id" value={a.id} />
                              <SubmitButton size="sm" variant="ghost" confirm={`${u.username} kullanıcısından ${LABELS.role[a.role]} rolü kaldırılsın mı?`}>
                                Kaldır
                              </SubmitButton>
                            </ActionForm>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Td>
                  <Td className="text-xs">{fmtDateTime(u.lastLoginAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardTitle>Öğrenci hesapları ({data.students.length})</CardTitle>
          <Table>
            <thead>
              <tr>
                <Th>Hesap</Th>
                <Th>Öğrenci no</Th>
                <Th>Ana dal</Th>
                <Th>Son giriş</Th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((u) => (
                <tr key={u.id}>
                  <Td>
                    <p className="font-medium">{u.displayName}</p>
                    <p className="text-xs text-su-subtle">{u.username}</p>
                  </Td>
                  <Td>{u.studentNo ?? <Badge tone="warn">Bilgi girilmedi</Badge>}</Td>
                  <Td>{u.mainProgramName ?? '—'}</Td>
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
