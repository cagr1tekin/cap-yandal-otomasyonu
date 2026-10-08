import { STUDENTS, studentEmail } from './students';

/**
 * Hesaplar. Üç giriş türü vardır (koordinatör, öğrenci, bölüm başkanı); hesapları koordinatör açar.
 * Kişi adları bilerek kullanılmaz; personel hesapları görev adıyla anılır.
 */
export type SeedRole = 'KOORDINATOR' | 'OGRENCI' | 'BOLUM_BASKANI';

export interface SeedUser {
  username: string;
  displayName: string;
  email: string;
  role: SeedRole;
}

/** Yerel geliştirme için ortak deneme şifresi; yalnızca infra/keycloak/realm.json içinde kullanılır. */
export const DEV_PASSWORD = 'Deneme.2026';

export const STAFF: SeedUser[] = [
  { username: 'koord.bilgisayar', displayName: 'ÇAP ve YDP Koordinatörü', email: 'koord.bilgisayar@personel.test', role: 'KOORDINATOR' },
  { username: 'bolum.bilgisayar', displayName: 'Bilgisayar Mühendisliği Bölüm Başkanı', email: 'bolum.bilgisayar@personel.test', role: 'BOLUM_BASKANI' },
];

export const STUDENT_USERS: SeedUser[] = STUDENTS.map((s) => ({ username: s.studentNo, displayName: s.fullName, email: studentEmail(s.studentNo), role: 'OGRENCI' }));

export const USERS: SeedUser[] = [...STAFF, ...STUDENT_USERS];
