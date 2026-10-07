import { COURSES, PROGRAMS, type SeedProgram } from './catalog';

/**
 * Program müfredatları (TEMSİLÎ). Gerçek ders planları Bologna paketlerinden alınabilir;
 * burada her lisans programı 240 AKTS'yi aşacak biçimde üretilir.
 *
 * Ortak dersler (Atatürk İlkeleri, Türk Dili, Yabancı Dil) her programda aynı kodla bulunur.
 * ÇAP Yönergesi m.7/2: "Ana dalında yer alan ve iki program için de ortak kabul edilen derslerin
 * (Genel Kültür vb. alan dışı dersler) AKTS kredileri toplamı dahil edilir."
 */

export interface SeedCurriculumCourse {
  code: string;
  name: string;
  ects: number;
  semester: number;
  common: boolean;
}

export const COMMON_COURSES: SeedCurriculumCourse[] = [
  { code: 'ATA101', name: 'Atatürk İlkeleri ve İnkılap Tarihi I', ects: 2, semester: 1, common: true },
  { code: 'ATA102', name: 'Atatürk İlkeleri ve İnkılap Tarihi II', ects: 2, semester: 2, common: true },
  { code: 'TDL101', name: 'Türk Dili I', ects: 2, semester: 1, common: true },
  { code: 'TDL102', name: 'Türk Dili II', ects: 2, semester: 2, common: true },
  { code: 'YDL101', name: 'Yabancı Dil I', ects: 3, semester: 1, common: true },
  { code: 'YDL102', name: 'Yabancı Dil II', ects: 3, semester: 2, common: true },
];

export const coursePrefix = (programId: string) => programId.split('-').slice(-1)[0];

const FIELD_COURSES = 38;

function build(p: SeedProgram): SeedCurriculumCourse[] {
  const prefix = coursePrefix(p.id);
  const known = COURSES.filter((c) => c.code.startsWith(prefix) && /^\D+\d+$/.test(c.code) && c.code.replace(/\d+$/, '') === prefix);
  const out: SeedCurriculumCourse[] = [...COMMON_COURSES];
  const used = new Set<string>();
  for (const c of known) {
    used.add(c.code);
    out.push({ code: c.code, name: c.name, ects: c.ects, semester: Number(c.code.slice(prefix.length, prefix.length + 1)) * 2 - 1, common: false });
  }
  let n = 1;
  for (let sem = 1; out.filter((c) => !c.common).length < FIELD_COURSES; sem = (sem % (p.durationYears * 2)) + 1) {
    const code = `${prefix}${Math.ceil(sem / 2)}${String(n).padStart(2, '0')}`;
    n++;
    if (used.has(code)) continue;
    used.add(code);
    out.push({ code, name: `${p.name} Alan Dersi ${n - 1}`, ects: 6, semester: sem, common: false });
  }
  return out;
}

export const CURRICULA: Record<string, SeedCurriculumCourse[]> = Object.fromEntries(PROGRAMS.map((p) => [p.id, build(p)]));
