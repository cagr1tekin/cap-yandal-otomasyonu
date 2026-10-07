import { OFFERINGS, PROGRAMS, UNITS } from './catalog';
import { STUDENTS } from './students';

/**
 * Panel yalnızca personel içindir (docs/KARARLAR.md K-1). Öğrenciler kullanıcı değildir;
 * öğrenci verisi sahte OBİS'tedir.
 */
export type Role = 'KOORDINATOR' | 'DANISMAN' | 'BOLUM_BASKANI' | 'BIRIM' | 'OIDB';

export interface SeedUser {
  username: string;
  displayName: string;
  email: string;
  /** Kapsamlı rol atamaları; yetkinin tek kaynağı (Keycloak yalnızca kimlik doğrular). */
  assignments: { role: Role; unitId?: string; programId?: string }[];
}

/** Yerel geliştirme için ortak deneme şifresi; yalnızca infra/keycloak/realm.json içinde kullanılır. */
export const DEV_PASSWORD = 'Deneme.2026';

const slug = (programId: string) => PROGRAMS.find((p) => p.id === programId)!.slug;

export const coordinatorUsername = (programId: string) => `koord.${slug(programId)}`;
export const headUsername = (programId: string) => `bolum.${slug(programId)}`;

const oidb: SeedUser[] = [
  { username: 'oidb.yonetici', displayName: 'ÖİDB Yöneticisi', email: 'oidb@personel.test', assignments: [{ role: 'OIDB' }] },
];

const unitStaff: SeedUser[] = UNITS.map((u) => ({
  username: `birim.${u.code.toLowerCase()}`,
  displayName: `${u.name} Öğrenci İşleri`,
  email: `birim.${u.code.toLowerCase()}@personel.test`,
  assignments: [{ role: 'BIRIM', unitId: u.id }],
}));

/** Her programın bölüm başkanı: hem hedef (ÇAP/yan dal) hem ana dal onaylarında imzacıdır. */
const heads: SeedUser[] = PROGRAMS.map((p) => ({
  username: headUsername(p.id),
  displayName: `${p.name} Bölüm Başkanı`,
  email: `${headUsername(p.id)}@personel.test`,
  assignments: [{ role: 'BOLUM_BASKANI', programId: p.id }],
}));

const coordinators: SeedUser[] = [...new Set(OFFERINGS.map((o) => o.programId))].map((programId) => {
  const prog = PROGRAMS.find((p) => p.id === programId)!;
  return {
    username: coordinatorUsername(programId),
    displayName: `ÇAP ve Yan Dal Koordinatörü ${prog.name}`,
    email: `${coordinatorUsername(programId)}@personel.test`,
    assignments: [{ role: 'KOORDINATOR', programId }],
  };
});

/** Ana dal danışmanları (OBİS'teki danışman kullanıcı adlarıyla aynı). */
const advisors: SeedUser[] = [...new Set(STUDENTS.map((s) => s.advisorUsername))].map((username) => ({
  username,
  displayName: `Danışman ${username.split('.')[1]}`,
  email: `${username}@personel.test`,
  assignments: [{ role: 'DANISMAN' }],
}));

export const USERS: SeedUser[] = [...oidb, ...unitStaff, ...heads, ...coordinators, ...advisors];
