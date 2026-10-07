import type { RuleSetDefinition } from './types';

const CAP = 'ÇAP Yön.';
const YD = 'Yan Dal Yön.';

/**
 * Selçuk Üniversitesi Çift Ana Dal Yönergesi (Senato 20/5/2026, 2026-20).
 * Kural kimlikleri PRD bölüm 5.1 ve 5.2 ile aynıdır.
 */
export const CAP_RULE_SET_V1: RuleSetDefinition = {
  version: 'CAP-2026.2',
  type: 'CAP',
  effectiveFrom: '2026-05-20',
  rules: [
    { code: 'KR-ÇAP-00', kind: 'NOT_OWN_PROGRAM', article: `${CAP} m.3`, title: 'Ana dal dışında bir program', appliesTo: 'CAP', phase: 'APPLICATION', params: {} },
    { code: 'KR-ÇAP-01', kind: 'ALL_COURSES_PASSED', article: `${CAP} m.5/1-d`, title: 'Tüm derslerin alınıp geçilmesi', appliesTo: 'CAP', phase: 'APPLICATION', params: {} },
    { code: 'KR-ÇAP-02', kind: 'MIN_GANO', article: `${CAP} m.5/1-d`, title: 'Asgari GNO', appliesTo: 'CAP', phase: 'APPLICATION', params: { min: 2.75 } },
    {
      code: 'KR-ÇAP-03',
      kind: 'ANY_OF',
      article: `${CAP} m.5/1-d`,
      title: 'Başarı sıralaması veya taban puan',
      appliesTo: 'CAP',
      phase: 'APPLICATION',
      params: {
        rules: [
          { code: 'KR-ÇAP-03a', kind: 'CLASS_RANK_TOP', title: 'Sınıfında en üst %20', params: { percent: 20 } },
          { code: 'KR-ÇAP-03b', kind: 'ENTRY_SCORE_GTE_BASE', title: 'YKS puanı ≥ taban puan', params: {} },
        ],
      },
    },
    { code: 'KR-ÇAP-04', kind: 'SUCCESS_RANK_REQUIREMENT', article: `${CAP} m.5/1-e`, title: 'YÖK başarı sıralaması şartı', appliesTo: 'CAP', phase: 'APPLICATION', params: {} },
    {
      code: 'KR-ÇAP-05',
      kind: 'SEMESTER_WINDOW',
      article: `${CAP} m.5/1-f`,
      title: 'Başvuru yarıyılı',
      appliesTo: 'CAP',
      phase: 'APPLICATION',
      params: { byDuration: { ONLISANS: [2, 3], '4': [3, 5], '5': [3, 7], '6': [3, 9] } },
    },
    { code: 'KR-ÇAP-06', kind: 'MAX_ACTIVE_TRACKS', article: `${CAP} m.5/1-ğ`, title: 'Tek çift ana dal', appliesTo: 'CAP', phase: 'APPLICATION', params: { max: 1 } },
    { code: 'KR-ÇAP-06b', kind: 'NOT_SAME_PROGRAM_BOTH', article: `${CAP} m.5/1-ğ`, title: 'Aynı programda yan dal olmaması', appliesTo: 'CAP', phase: 'APPLICATION', params: {} },
    { code: 'KR-ÇAP-07', kind: 'TALENT_EXAM_PASSED', article: `${CAP} m.5/1-h`, title: 'Yetenek sınavı', appliesTo: 'CAP', phase: 'APPLICATION', params: {} },
    { code: 'KR-ÇAP-08', kind: 'SOURCE_PROGRAM_ALLOWED', article: 'Kontenjan ilanı (dipnot)', title: 'Kabul edilen bölümler', appliesTo: 'CAP', phase: 'APPLICATION', params: {} },
    {
      code: 'KR-ÇAP-09',
      kind: 'MIN_QUOTA_RATIO',
      article: `${CAP} m.5/1-c`,
      title: 'Asgari kontenjan',
      appliesTo: 'CAP',
      phase: 'CONFIGURATION',
      params: { percent: 20, exemptCategories: ['HUKUK', 'TIP', 'SAGLIK', 'MUHENDISLIK'] },
    },
    { code: 'KR-ÇAP-10', kind: 'CONSECUTIVE_TERMS_NO_COURSE', article: `${CAP} m.9/1-d`, title: 'Üst üste ders almama', appliesTo: 'CAP', phase: 'TERM_END', params: { terms: 2 } },
    {
      code: 'KR-ÇAP-11',
      kind: 'GANO_DROP_STRIKES',
      article: `${CAP} m.9/1-e`,
      title: 'Ana dal GNO düşüşü',
      appliesTo: 'CAP',
      phase: 'TERM_END',
      // YÖK Geçiş Yön. m.17/4 (docs/KARARLAR.md K-2): bir defa 2,50'ye kadar; ikinci kez 2,72 altı kayıt silme.
      params: { threshold: 2.72, floor: 2.5, allowedStrikes: 1 },
    },
    { code: 'KR-ÇAP-12', kind: 'FROZEN_WITH_MAIN', article: `${CAP} m.9/1-ç`, title: 'Ana dalla birlikte dondurma', appliesTo: 'CAP', phase: 'TERM_END', params: {} },
    {
      code: 'KR-ÇAP-18',
      kind: 'PROTOCOL_TOTAL_ECTS',
      article: `${CAP} m.7/2`,
      title: 'Protokol AKTS toplamı',
      appliesTo: 'CAP',
      phase: 'PROTOCOL',
      // Yönerge yalnızca ön lisans (120) ve 4 yıllık lisans (240) için sayı verir.
      params: { byLevel: { ONLISANS: 120, '4': 240 } },
    },
    { code: 'KR-ÇAP-19', kind: 'NO_MAIN_OVERLAP', article: 'İİBF ÇAP/Yan Dal İlkeleri 2023-24', title: 'Ana dal dersi tekrar alınamaz', appliesTo: 'CAP', phase: 'PROTOCOL', params: {} },
    { code: 'KR-ÇAP-13', kind: 'GRADUATION_CAP', article: `${CAP} m.7/2, m.8/1-c,ç`, title: 'Çift ana dal diploması', appliesTo: 'CAP', phase: 'GRADUATION', params: { minMainGano: 2.72 } },
  ],
};

/** Selçuk Üniversitesi Yan Dal Yönergesi (Senato 26/10/2023, 2023-131). */
export const YANDAL_RULE_SET_V1: RuleSetDefinition = {
  version: 'YANDAL-2023.2',
  type: 'YANDAL',
  effectiveFrom: '2023-10-26',
  rules: [
    { code: 'KR-YD-00', kind: 'NOT_OWN_PROGRAM', article: `${YD} m.3/1-e`, title: 'Ana dal dışında bir program', appliesTo: 'YANDAL', phase: 'APPLICATION', params: {} },
    { code: 'KR-YD-01', kind: 'ALL_COURSES_PASSED', article: `${YD} m.5/1-d`, title: 'Tüm derslerin alınıp geçilmesi', appliesTo: 'YANDAL', phase: 'APPLICATION', params: {} },
    { code: 'KR-YD-02', kind: 'MIN_GANO', article: `${YD} m.5/1-d`, title: 'Asgari GNO', appliesTo: 'YANDAL', phase: 'APPLICATION', params: { min: 2.5 } },
    { code: 'KR-YD-03', kind: 'SEMESTER_WINDOW', article: `${YD} m.5/1-ç`, title: 'Başvuru yarıyılı', appliesTo: 'YANDAL', phase: 'APPLICATION', params: { byDuration: { '*': [3, 6] } } },
    { code: 'KR-YD-04', kind: 'MAX_ACTIVE_TRACKS', article: `${YD} m.6/3`, title: 'Tek yan dal', appliesTo: 'YANDAL', phase: 'APPLICATION', params: { max: 1 } },
    { code: 'KR-YD-04b', kind: 'NOT_SAME_PROGRAM_BOTH', article: `${CAP} m.5/1-ğ`, title: 'Aynı programda çift ana dal olmaması', appliesTo: 'YANDAL', phase: 'APPLICATION', params: {} },
    { code: 'KR-YD-09', kind: 'NOT_PREVIOUSLY_REMOVED', article: `${YD} m.7/11`, title: 'Daha önce kaydı silinmemiş olma', appliesTo: 'YANDAL', phase: 'APPLICATION', params: {} },
    { code: 'KR-YD-05', kind: 'MINOR_PLAN_LIMITS', article: `${YD} m.5/1-g`, title: 'Yan dal ders planı', appliesTo: 'YANDAL', phase: 'PROTOCOL', params: { minEcts: 30, minCourses: 6, poolMinEcts: 60 } },
    { code: 'KR-YD-13', kind: 'NO_MAIN_OVERLAP', article: 'Yan Dal Uygulama Esasları m.3; İİBF İlkeleri', title: 'Ana dal dersi yan dalda sayılmaz', appliesTo: 'YANDAL', phase: 'PROTOCOL', params: {} },
    { code: 'KR-YD-06', kind: 'MAIN_GANO_BELOW', article: `${YD} m.7/5`, title: 'Ana dal GNO alt sınırı', appliesTo: 'YANDAL', phase: 'TERM_END', params: { min: 2.3, warnMargin: 0.15 } },
    { code: 'KR-YD-07', kind: 'TRACK_GPA_CONSECUTIVE_BELOW', article: `${YD} m.7/6`, title: 'Yan dal ortalaması', appliesTo: 'YANDAL', phase: 'TERM_END', params: { min: 2.0, terms: 2 } },
    { code: 'KR-YD-08', kind: 'CONSECUTIVE_TERMS_NO_COURSE', article: `${YD} m.7/4`, title: 'Üst üste ders almama', appliesTo: 'YANDAL', phase: 'TERM_END', params: { terms: 2 } },
    { code: 'KR-YD-12', kind: 'FROZEN_WITH_MAIN', article: `${YD} m.7/2`, title: 'Ana dalla birlikte izin', appliesTo: 'YANDAL', phase: 'TERM_END', params: {} },
    { code: 'KR-YD-10', kind: 'GRADUATION_MINOR', article: `${YD} m.7/8`, title: 'Yan dal sertifikası', appliesTo: 'YANDAL', phase: 'GRADUATION', params: { minTrackGpa: 2.0 } },
  ],
};

export const DEFAULT_RULE_SETS = [CAP_RULE_SET_V1, YANDAL_RULE_SET_V1];
