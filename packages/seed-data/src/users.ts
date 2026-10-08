import { HOME_PROGRAM_ID } from './catalog';
import { STUDENTS, studentEmail } from './students';

/**
 * Personel rolleri (docs/KARARLAR.md K-12). Öğrenciye rol atanmaz: personel rolü olmayan hesap öğrencidir.
 * Kişi adları bilerek kullanılmaz; hesaplar görev adıyla anılır.
 */
export type StaffRole = 'KOORDINATOR' | 'DANISMAN' | 'BOLUM_BASKANI';

export interface SeedUser {
  username: string;
  displayName: string;
  email: string;
  /** Kapsamlı rol atamaları; yetkinin tek kaynağı (Keycloak yalnızca kimlik doğrular). */
  assignments: { role: StaffRole; programId?: string }[];
}

/** Yerel geliştirme için ortak deneme şifresi; yalnızca infra/keycloak/realm.json içinde kullanılır. */
export const DEV_PASSWORD = 'Deneme.2026';

const staff = (username: string, displayName: string, assignments: SeedUser['assignments']): SeedUser => ({
  username,
  displayName,
  email: `${username}@personel.test`,
  assignments,
});

export const STAFF: SeedUser[] = [
  staff('bolum.bilgisayar', 'Bilgisayar Mühendisliği Bölüm Başkanı', [{ role: 'BOLUM_BASKANI', programId: HOME_PROGRAM_ID }]),
  staff('koord.bilgisayar', 'ÇAP ve Yan Dal Komisyonu Başkanı', [{ role: 'KOORDINATOR' }]),
  staff('koord.uye', 'ÇAP ve Yan Dal Komisyonu Üyesi', [{ role: 'KOORDINATOR' }]),
  // Ana dal bölümlerinin imzacıları: yalnızca imza ve kendi öğrencilerini görme yetkileri vardır.
  staff('bolum.eem', 'Elektrik-Elektronik Mühendisliği Bölüm Başkanı', [{ role: 'BOLUM_BASKANI', programId: 'P-EEM' }]),
  staff('bolum.makine', 'Makine Mühendisliği Bölüm Başkanı', [{ role: 'BOLUM_BASKANI', programId: 'P-MAK' }]),
  staff('danisman.eem', 'Elektrik-Elektronik Mühendisliği Danışmanı', [{ role: 'DANISMAN', programId: 'P-EEM' }]),
  staff('danisman.makine', 'Makine Mühendisliği Danışmanı', [{ role: 'DANISMAN', programId: 'P-MAK' }]),
];

export const STUDENT_USERS: SeedUser[] = STUDENTS.map((s) => ({
  username: s.studentNo,
  displayName: s.fullName,
  email: studentEmail(s.studentNo),
  assignments: [],
}));

export const USERS: SeedUser[] = [...STAFF, ...STUDENT_USERS];
