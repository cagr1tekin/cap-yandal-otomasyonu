import type {
  EvaluationContext,
  Evaluator,
  RuleDefinition,
  RuleEffects,
  RuleResult,
  RuleStatus,
} from './types';

/** 2.75 → "2,75" */
export function fmt(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

function make(
  rule: RuleDefinition,
  status: RuleStatus,
  message: string,
  extra: Partial<Pick<RuleResult, 'actual' | 'expected' | 'effects' | 'children'>> = {},
): RuleResult {
  return {
    code: rule.code,
    kind: rule.kind,
    article: rule.article,
    title: rule.title,
    status,
    message,
    ...extra,
  };
}

function na(rule: RuleDefinition, message = 'Bu kural bu durumda uygulanmaz.'): RuleResult {
  return make(rule, 'NOT_APPLICABLE', message);
}

function num(rule: RuleDefinition, key: string): number {
  const v = rule.params[key];
  if (typeof v !== 'number') {
    throw new Error(`${rule.code}: '${key}' parametresi sayı olmalı`);
  }
  return v;
}

const allCoursesPassed: Evaluator = (rule, { student }) => {
  if (!student) return na(rule);
  return student.completedAllCoursesToDate
    ? make(rule, 'PASS', 'Başvuru dönemine kadarki tüm derslerini almış ve geçmiş.')
    : make(rule, 'FAIL', 'Başvuru dönemine kadar alınması gereken derslerden alınmamış ya da başarısız olunan var.');
};

const minGano: Evaluator = (rule, { student }) => {
  if (!student) return na(rule);
  const min = num(rule, 'min');
  return student.gano >= min
    ? make(rule, 'PASS', `GNO ${fmt(student.gano)} ≥ ${fmt(min)}`, { actual: student.gano, expected: min })
    : make(rule, 'FAIL', `GNO ${fmt(student.gano)} < ${fmt(min)}`, { actual: student.gano, expected: min });
};

const classRankTop: Evaluator = (rule, { student }) => {
  if (!student) return na(rule);
  const percent = num(rule, 'percent');
  const p = student.classRankPercentile;
  if (p === null) {
    return make(rule, 'FAIL', 'Sınıf başarı sıralaması bilgisi yok.', { expected: percent });
  }
  return p <= percent
    ? make(rule, 'PASS', `Sınıfında en üst %${p} içinde (sınır %${percent}).`, { actual: p, expected: percent })
    : make(rule, 'FAIL', `Sınıfında en üst %${p} içinde; en üst %${percent} gerekli.`, { actual: p, expected: percent });
};

const entryScoreGteBase: Evaluator = (rule, { student, offering, osymVerified }) => {
  if (!student || !offering) return na(rule);
  const base = offering.programBaseScore;
  const entry = student.entryScore;
  if (base === null) return make(rule, 'FAIL', 'Programın taban puanı bilinmiyor.');
  if (entry === null) return make(rule, 'FAIL', 'Yerleştirme puanı bilgisi yok.', { expected: base });
  if (entry.score < base) {
    return make(rule, 'FAIL', `YKS puanı ${fmt(entry.score)} < taban puan ${fmt(base)}`, {
      actual: entry.score,
      expected: base,
    });
  }
  return osymVerified
    ? make(rule, 'PASS', `YKS puanı ${fmt(entry.score)} ≥ taban puan ${fmt(base)} (belge doğrulandı).`, {
        actual: entry.score,
        expected: base,
      })
    : make(rule, 'CONDITIONAL', `YKS puanı ${fmt(entry.score)} ≥ taban puan ${fmt(base)}; ÖSYM sonuç belgesi doğrulanmalı.`, {
        actual: entry.score,
        expected: base,
      });
};

const successRankRequirement: Evaluator = (rule, { student, offering }) => {
  if (!student || !offering) return na(rule);
  if (!offering.requiresSuccessRank) return na(rule, 'Programda başarı sıralaması şartı yok.');
  return student.yokRankRequirementMet === true
    ? make(rule, 'PASS', 'Kayıt yılındaki YÖK başarı sıralaması şartını sağlıyor.')
    : make(rule, 'FAIL', 'Kayıt yılındaki YÖK başarı sıralaması şartı sağlanmıyor.');
};

const semesterWindow: Evaluator = (rule, { student }) => {
  if (!student) return na(rule);
  const byDuration = rule.params.byDuration as Record<string, [number, number]>;
  const key = student.level === 'ONLISANS' ? 'ONLISANS' : String(student.durationYears);
  const window = byDuration[key] ?? byDuration['*'];
  if (!window) return make(rule, 'FAIL', 'Bu program süresi için başvuru dönemi tanımlı değil.');
  const [min, max] = window;
  const expected = `${min}.–${max}. yarıyıl`;
  return student.semesterNo >= min && student.semesterNo <= max
    ? make(rule, 'PASS', `${student.semesterNo}. yarıyıl, başvuru aralığında (${expected}).`, {
        actual: student.semesterNo,
        expected,
      })
    : make(rule, 'FAIL', `${student.semesterNo}. yarıyıl; başvuru yalnızca ${expected} başında yapılabilir.`, {
        actual: student.semesterNo,
        expected,
      });
};

const maxActiveTracks: Evaluator = (rule, { enrollments, offering }) => {
  if (!enrollments || !offering) return na(rule);
  const max = num(rule, 'max');
  const active = enrollments.filter(
    (e) => e.type === offering.type && (e.status === 'ACTIVE' || e.status === 'FROZEN'),
  ).length;
  const label = offering.type === 'CAP' ? 'çift ana dal' : 'yan dal';
  return active < max
    ? make(rule, 'PASS', `Etkin ${label} kaydı: ${active} (en çok ${max}).`, { actual: active, expected: max })
    : make(rule, 'FAIL', `Zaten ${active} etkin ${label} kaydı var; aynı anda en çok ${max} olabilir.`, {
        actual: active,
        expected: max,
      });
};

const notSameProgramBoth: Evaluator = (rule, { enrollments, offering }) => {
  if (!enrollments || !offering) return na(rule);
  const clash = enrollments.some(
    (e) =>
      e.programId === offering.programId &&
      e.type !== offering.type &&
      (e.status === 'ACTIVE' || e.status === 'FROZEN'),
  );
  return clash
    ? make(rule, 'FAIL', 'Aynı programda hem çift ana dal hem yan dal yapılamaz.')
    : make(rule, 'PASS', 'Bu programda başka türde etkin kayıt yok.');
};

const notOwnProgram: Evaluator = (rule, { student, offering }) => {
  if (!student || !offering) return na(rule);
  return student.programId === offering.programId
    ? make(rule, 'FAIL', 'Kendi ana dal programına başvurulamaz.')
    : make(rule, 'PASS', 'Başvurulan program ana dal programından farklı.');
};

const talentExamPassed: Evaluator = (rule, { student, offering }) => {
  if (!student || !offering) return na(rule);
  if (!offering.requiresTalentExam) return na(rule, 'Program yetenek sınavıyla öğrenci almıyor.');
  return student.talentExamPassedProgramIds.includes(offering.programId)
    ? make(rule, 'PASS', 'Programın yetenek sınavında başarılı.')
    : make(rule, 'FAIL', 'Programın yetenek sınavında başarılı olunması gerekir.');
};

const sourceProgramAllowed: Evaluator = (rule, { student, offering }) => {
  if (!student || !offering) return na(rule);
  if (offering.sourceProgramIds.length === 0) {
    return make(rule, 'PASS', 'Program tüm bölümlerden öğrenci kabul ediyor.');
  }
  return offering.sourceProgramIds.includes(student.programId)
    ? make(rule, 'PASS', 'Ana dal programı, kabul edilen bölümler arasında.')
    : make(rule, 'FAIL', 'Bu program yalnızca ilan edilen bölümlerden öğrenci kabul ediyor; ana dal programı listede yok.');
};

const minQuotaRatio: Evaluator = (rule, { offering }) => {
  if (!offering || offering.type !== 'CAP') return na(rule);
  const exempt = (rule.params.exemptCategories as string[]) ?? [];
  if (exempt.includes(offering.programCategory)) {
    return na(rule, 'Program kategorisi asgari kontenjan oranından muaf.');
  }
  if (offering.firstYearIntake === null) {
    return make(rule, 'WARN', 'Birinci sınıf mevcudu girilmediği için asgari kontenjan denetlenemedi.');
  }
  const percent = num(rule, 'percent');
  const min = Math.ceil((offering.firstYearIntake * percent) / 100);
  return offering.quota >= min
    ? make(rule, 'PASS', `Kontenjan ${offering.quota} ≥ asgari ${min}.`, { actual: offering.quota, expected: min })
    : make(rule, 'WARN', `Kontenjan ${offering.quota}, asgari ${min} değerinin altında (1. sınıf mevcudunun %${percent}'i); gerekçe gerekir.`, {
        actual: offering.quota,
        expected: min,
      });
};

const consecutiveTermsNoCourse: Evaluator = (rule, { history, student }) => {
  if (!history) return na(rule);
  if (student?.frozen) return na(rule, 'Kayıt dondurulmuş; ders almama sayılmaz.');
  if (history.onLeave) return na(rule, 'Bu dönem için dönem izni kayıtlı; ders almama sayılmaz.');
  const terms = num(rule, 'terms');
  const n = history.consecutiveTermsWithoutCourse;
  if (n >= terms) {
    return make(rule, 'FAIL', `Üst üste ${n} dönem ders alınmamış (sınır ${terms}).`, { actual: n, expected: terms });
  }
  if (n === terms - 1) {
    return make(rule, 'WARN', `Bu dönem ders alınmadı; bir dönem daha alınmazsa kayıt silinir.`, {
      actual: n,
      expected: terms,
    });
  }
  return make(rule, 'PASS', 'Ders alma sürekliliği sağlanıyor.', { actual: n, expected: terms });
};

const ganoDropStrikes: Evaluator = (rule, { history }) => {
  if (!history) return na(rule);
  // YÖK Geçiş Yön. m.17/4: bir defaya mahsus 65'e (2,50) kadar düşebilir; ikinci kez 70'in (2,72) altı kayıt silme.
  const threshold = num(rule, 'threshold');
  const floor = num(rule, 'floor');
  const allowed = num(rule, 'allowedStrikes');
  const g = history.mainGano;
  if (g >= threshold) {
    return make(rule, 'PASS', `Ana dal GNO ${fmt(g)} ≥ ${fmt(threshold)}`, { actual: g, expected: threshold });
  }
  const effects: RuleEffects = { incrementGanoStrikes: true };
  if (g < floor) {
    return make(rule, 'FAIL', `Ana dal GNO ${fmt(g)} < ${fmt(floor)}; izin verilen düşüş ${fmt(floor)}'e kadardır.`, {
      actual: g,
      expected: floor,
      effects,
    });
  }
  if (history.ganoStrikes < allowed) {
    return make(
      rule,
      'WARN',
      `Ana dal GNO ${fmt(g)} < ${fmt(threshold)}. Bir defaya mahsus izin kullanılıyor; tekrarında kayıt silinir.`,
      { actual: g, expected: threshold, effects },
    );
  }
  return make(rule, 'FAIL', `Ana dal GNO ${fmt(g)} < ${fmt(threshold)}; düşüş ikinci kez yaşandı.`, {
    actual: g,
    expected: threshold,
    effects,
  });
};

const mainGanoBelow: Evaluator = (rule, { history }) => {
  if (!history) return na(rule);
  const min = num(rule, 'min');
  const margin = num(rule, 'warnMargin');
  const g = history.mainGano;
  if (g < min) return make(rule, 'FAIL', `Ana dal GNO ${fmt(g)} < ${fmt(min)}`, { actual: g, expected: min });
  if (g < min + margin) {
    return make(rule, 'WARN', `Ana dal GNO ${fmt(g)}, sınıra (${fmt(min)}) yakın.`, { actual: g, expected: min });
  }
  return make(rule, 'PASS', `Ana dal GNO ${fmt(g)} ≥ ${fmt(min)}`, { actual: g, expected: min });
};

const trackGpaConsecutiveBelow: Evaluator = (rule, { history }) => {
  if (!history) return na(rule);
  const min = num(rule, 'min');
  const terms = num(rule, 'terms');
  const list = history.trackGpaByTerm;
  if (list.length === 0) return na(rule, 'Henüz dönem ortalaması yok.');
  const last = list.slice(-terms);
  const last1 = list[list.length - 1];
  if (last.length === terms && last.every((g) => g < min)) {
    return make(rule, 'FAIL', `Program ortalaması üst üste ${terms} dönem ${fmt(min)} altında.`, {
      actual: last1,
      expected: min,
    });
  }
  if (last1 < min) {
    return make(rule, 'WARN', `Program ortalaması ${fmt(last1)} < ${fmt(min)}; gelecek dönem de altında kalırsa kayıt silinir.`, {
      actual: last1,
      expected: min,
    });
  }
  return make(rule, 'PASS', `Program ortalaması ${fmt(last1)} ≥ ${fmt(min)}`, { actual: last1, expected: min });
};

const notPreviouslyRemoved: Evaluator = (rule, { offering, previouslyRemovedProgramIds }) => {
  if (!offering || !previouslyRemovedProgramIds) return na(rule);
  return previouslyRemovedProgramIds.includes(offering.programId)
    ? make(rule, 'FAIL', 'Bu yan dal programından daha önce kaydı silinmiş; yeniden kayıt yapılamaz.')
    : make(rule, 'PASS', 'Bu programdan daha önce kayıt silinmemiş.');
};

const minorPlanLimits: Evaluator = (rule, { minorPlan }) => {
  if (!minorPlan) return na(rule);
  const minEcts = num(rule, 'minEcts');
  const minCourses = num(rule, 'minCourses');
  const poolMinEcts = num(rule, 'poolMinEcts');
  if (minorPlan.poolEcts < poolMinEcts) {
    return make(rule, 'FAIL', `Ders havuzu ${minorPlan.poolEcts} AKTS; en az ${poolMinEcts} AKTS olmalı.`, {
      actual: minorPlan.poolEcts,
      expected: poolMinEcts,
    });
  }
  const expected = `≥ ${minEcts} AKTS ve ≥ ${minCourses} ders`;
  const actual = `${minorPlan.planEcts} AKTS, ${minorPlan.planCourseCount} ders`;
  return minorPlan.planEcts >= minEcts && minorPlan.planCourseCount >= minCourses
    ? make(rule, 'PASS', `Plan: ${actual} (${expected}).`, { actual, expected })
    : make(rule, 'FAIL', `Plan: ${actual}; ${expected} gerekli.`, { actual, expected });
};

const protocolTotalEcts: Evaluator = (rule, { protocol }) => {
  if (!protocol) return na(rule);
  const byLevel = rule.params.byLevel as Record<string, number>;
  const key = protocol.level === 'ONLISANS' ? 'ONLISANS' : String(protocol.durationYears);
  const required = byLevel[key];
  if (required === undefined) {
    return na(rule, `Yönergede ${protocol.durationYears} yıllık programlar için AKTS toplamı tanımlı değil.`);
  }
  const total = protocol.courseEcts + protocol.commonEcts;
  const detail = `${protocol.courseEcts} protokol + ${protocol.commonEcts} ortak = ${total} AKTS`;
  return total >= required
    ? make(rule, 'PASS', `${detail} ≥ ${required}.`, { actual: total, expected: required })
    : make(rule, 'FAIL', `${detail}; en az ${required} AKTS gerekli.`, { actual: total, expected: required });
};

const noMainOverlap: Evaluator = (rule, { protocol }) => {
  if (!protocol) return na(rule);
  return protocol.overlapCodes.length === 0
    ? make(rule, 'PASS', 'Protokolde ana dal müfredatındaki bir ders yok.')
    : make(rule, 'FAIL', `Ana dalda bulunan dersler protokole yazılamaz: ${protocol.overlapCodes.join(', ')}.`, {
        actual: protocol.overlapCodes.join(', '),
      });
};

const graduationCap: Evaluator = (rule, { graduation }) => {
  if (!graduation) return na(rule);
  const minMainGano = num(rule, 'minMainGano');
  const missing: string[] = [];
  if (!graduation.mainGraduated) missing.push('ana daldan mezuniyet');
  if (graduation.mainGano < minMainGano) missing.push(`ana dal GNO ≥ ${fmt(minMainGano)}`);
  if (!graduation.trackCompleted || graduation.trackEcts < graduation.requiredEcts) {
    missing.push(`çift ana dal derslerinin tamamlanması (${graduation.trackEcts}/${graduation.requiredEcts} AKTS)`);
  }
  return missing.length === 0
    ? make(rule, 'PASS', 'Çift ana dal diplomasına hak kazandı.')
    : make(rule, 'FAIL', `Eksik: ${missing.join(', ')}.`, {
        actual: graduation.trackEcts,
        expected: graduation.requiredEcts,
      });
};

const graduationMinor: Evaluator = (rule, { graduation }) => {
  if (!graduation) return na(rule);
  const minGpa = num(rule, 'minTrackGpa');
  const missing: string[] = [];
  if (!graduation.mainGraduated) missing.push('ana daldan mezuniyet');
  if (!graduation.trackCompleted) missing.push('yan dal planının tamamlanması');
  if (graduation.trackGpa === null || graduation.trackGpa < minGpa) {
    missing.push(`yan dal ortalaması ≥ ${fmt(minGpa)}`);
  }
  return missing.length === 0
    ? make(rule, 'PASS', 'Yan dal sertifikasına hak kazandı.')
    : make(rule, 'FAIL', `Eksik: ${missing.join(', ')}.`);
};

const frozenWithMain: Evaluator = (rule, { student }) => {
  if (!student) return na(rule);
  return student.frozen
    ? make(rule, 'WARN', 'Ana dalda kayıt dondurulmuş; bu programdaki kayıt da dondurulmuş sayılır.', {
        effects: { freezeEnrollment: true },
      })
    : make(rule, 'PASS', 'Ana dal kaydı etkin.');
};

/**
 * Süre sınırı: ana daldan mezun olup programı bitiremeyen öğrencinin kalabileceği süre.
 * ÇAP: kayıttan itibaren 2547 m.44/c azami süresi (ÇAP Yön. m.8/1-d, m.9/1-g); yan dal: mezuniyetten sonra
 * en çok iki yarıyıl (Yan Dal Yön. m.7/9).
 */
const maxDuration: Evaluator = (rule, { history }) => {
  if (!history) return na(rule);
  const max = num(rule, 'maxTerms');
  if (history.termsSinceMainGraduation == null) {
    return na(rule, 'Ana daldan mezuniyet kaydı yok; süre sınırı mezuniyetten sonra uygulanır.');
  }
  const fromAdmission = rule.params.basis === 'ADMISSION';
  const used = fromAdmission ? (history.termsSinceAdmission ?? 0) : history.termsSinceMainGraduation;
  const label = fromAdmission ? 'Kabulden bu yana' : 'Ana dal mezuniyetinden bu yana';
  if (used > max) {
    return make(rule, 'FAIL', `${label} ${used} yarıyıl geçti; en çok ${max} yarıyıl tanınır.`, { actual: used, expected: max });
  }
  if (used === max) {
    return make(rule, 'WARN', `${label} ${used} yarıyıl geçti; bu, tanınan son yarıyıl.`, { actual: used, expected: max });
  }
  return make(rule, 'PASS', `${label} ${used} yarıyıl (en çok ${max}).`, { actual: used, expected: max });
};

const anyOf: Evaluator = (rule, ctx) => {
  const subs = rule.params.rules as Array<Pick<RuleDefinition, 'code' | 'kind' | 'title' | 'params'>>;
  const children = subs.map((s) =>
    evaluateRule({ ...s, article: rule.article, appliesTo: rule.appliesTo, phase: rule.phase }, ctx),
  );
  if (children.some((c) => c.status === 'PASS')) {
    const ok = children.find((c) => c.status === 'PASS')!;
    return make(rule, 'PASS', `Sağlandı: ${ok.title}.`, { children });
  }
  if (children.some((c) => c.status === 'CONDITIONAL')) {
    const c = children.find((x) => x.status === 'CONDITIONAL')!;
    return make(rule, 'CONDITIONAL', `${c.title}: ${c.message}`, { children });
  }
  return make(rule, 'FAIL', `Seçeneklerden hiçbiri sağlanmıyor: ${children.map((c) => c.title).join(' / ')}.`, {
    children,
  });
};

export const evaluators: Record<string, Evaluator> = {
  ALL_COURSES_PASSED: allCoursesPassed,
  MIN_GANO: minGano,
  ANY_OF: anyOf,
  CLASS_RANK_TOP: classRankTop,
  ENTRY_SCORE_GTE_BASE: entryScoreGteBase,
  SUCCESS_RANK_REQUIREMENT: successRankRequirement,
  SEMESTER_WINDOW: semesterWindow,
  MAX_ACTIVE_TRACKS: maxActiveTracks,
  NOT_SAME_PROGRAM_BOTH: notSameProgramBoth,
  NOT_OWN_PROGRAM: notOwnProgram,
  TALENT_EXAM_PASSED: talentExamPassed,
  SOURCE_PROGRAM_ALLOWED: sourceProgramAllowed,
  MIN_QUOTA_RATIO: minQuotaRatio,
  CONSECUTIVE_TERMS_NO_COURSE: consecutiveTermsNoCourse,
  GANO_DROP_STRIKES: ganoDropStrikes,
  MAIN_GANO_BELOW: mainGanoBelow,
  TRACK_GPA_CONSECUTIVE_BELOW: trackGpaConsecutiveBelow,
  NOT_PREVIOUSLY_REMOVED: notPreviouslyRemoved,
  MINOR_PLAN_LIMITS: minorPlanLimits,
  GRADUATION_CAP: graduationCap,
  GRADUATION_MINOR: graduationMinor,
  FROZEN_WITH_MAIN: frozenWithMain,
  PROTOCOL_TOTAL_ECTS: protocolTotalEcts,
  NO_MAIN_OVERLAP: noMainOverlap,
  MAX_DURATION: maxDuration,
};

export function evaluateRule(rule: RuleDefinition, ctx: EvaluationContext): RuleResult {
  const ev = evaluators[rule.kind];
  if (!ev) throw new Error(`Bilinmeyen kural türü: ${rule.kind} (${rule.code})`);
  return ev(rule, ctx);
}
