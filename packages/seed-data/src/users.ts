import { OFFERINGS, PROGRAMS, UNITS } from './catalog';
import { STUDENTS, studentEmail } from './students';

export type Role = 'OGRENCI' | 'KOORDINATOR' | 'DANISMAN' | 'BOLUM_BASKANI' | 'BIRIM' | 'OIDB';

export interface SeedUser {
  username: string;
  displayName: string;
  email: string;
  roles: Role[];
  /** Kapsam: birim veya program. */
  assignments: { role: Role; unitId?: string; programId?: string }[];
}

/** Yerel geliştirme için ortak deneme şifresi; yalnızca infra/keycloak/realm.json içinde kullanılır. */
export const DEV_PASSWORD = 'Deneme.2026';

export const coordinatorUsername = (programId: string) =>
  `koord.${PROGRAMS.find((p) => p.id === programId)!.slug}`;

const staff: SeedUser[] = [
  { username: 'oidb.yonetici', displayName: 'ÖİDB Yöneticisi', email: 'oidb@personel.test', roles: ['OIDB'], assignments: [{ role: 'OIDB' }] },
  ...UNITS.map((u) => ({
    username: `birim.${u.code.toLowerCase()}`,
    displayName: `${u.name} Öğrenci İşleri`,
    email: `birim.${u.code.toLowerCase()}@personel.test`,
    roles: ['BIRIM' as Role],
    assignments: [{ role: 'BIRIM' as Role, unitId: u.id }],
  })),
  {
    username: 'bolum.iktisat',
    displayName: 'İktisat Bölüm Başkanı',
    email: 'bolum.iktisat@personel.test',
    roles: ['BOLUM_BASKANI'],
    assignments: [{ role: 'BOLUM_BASKANI', programId: 'P-IIBF-IKT' }],
  },
  {
    username: 'bolum.bilgisayar',
    displayName: 'Bilgisayar Mühendisliği Bölüm Başkanı',
    email: 'bolum.bilgisayar@personel.test',
    roles: ['BOLUM_BASKANI'],
    assignments: [{ role: 'BOLUM_BASKANI', programId: 'P-TF-BIL' }],
  },
];

const coordinators: SeedUser[] = [...new Set(OFFERINGS.map((o) => o.programId))].map((programId) => {
  const prog = PROGRAMS.find((p) => p.id === programId)!;
  return {
    username: coordinatorUsername(programId),
    displayName: `ÇAP/Yan Dal Koordinatörü — ${prog.name}`,
    email: `${coordinatorUsername(programId)}@personel.test`,
    roles: ['KOORDINATOR'],
    assignments: [{ role: 'KOORDINATOR', programId }],
  };
});

const advisors: SeedUser[] = [...new Set(STUDENTS.map((s) => s.advisorUsername))].map((username) => ({
  username,
  displayName: `Danışman (${username.split('.')[1]})`,
  email: `${username}@personel.test`,
  roles: ['DANISMAN'],
  assignments: [{ role: 'DANISMAN' }],
}));

const students: SeedUser[] = STUDENTS.map((s) => ({
  username: s.studentNo,
  displayName: s.fullName,
  email: studentEmail(s.studentNo),
  roles: ['OGRENCI'],
  assignments: [{ role: 'OGRENCI' }],
}));

export const USERS: SeedUser[] = [...staff, ...coordinators, ...advisors, ...students];
