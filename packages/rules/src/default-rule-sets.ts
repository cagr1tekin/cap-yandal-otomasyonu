import type { RuleSetDefinition } from './types';

const CAP = 'ÇAP Yön.';
const YD = 'Yan Dal Yön.';

/**
 * Selçuk Üniversitesi Çift Ana Dal Yönergesi. Başvuru değerlendirmesi sistemde yapılmadığı için
 * (dekanlık yapar) başvuru aşaması kuralları sette yer almaz; değerlendiricileri pakette durur.
 * Sistem yalnızca kayıtlı öğrencinin takibini yapar: dönem sonu, ders listesi ve mezuniyet.
 * Sayısal değerler koordinatör tarafından yeni sürümle değiştirilebilir; eski sürümler saklanır.
 */
export const CAP_RULE_SET_V1: RuleSetDefinition = {
  version: 'CAP-2026.4',
  type: 'CAP',
  effectiveFrom: '2026-05-20',
  rules: [
    { code: 'KR-ÇAP-10', kind: 'CONSECUTIVE_TERMS_NO_COURSE', article: `${CAP} m.9/1-d`, title: 'Üst üste ders almama', appliesTo: 'CAP', phase: 'TERM_END', params: { terms: 2 } },
    {
      code: 'KR-ÇAP-11',
      kind: 'GANO_DROP_STRIKES',
      article: `${CAP} m.9/1-e`,
      title: 'Ana dal GNO düşüşü',
      appliesTo: 'CAP',
      phase: 'TERM_END',
      // YÖK Geçiş Yön. m.17/4: bir defa 2,50'ye kadar; ikinci kez 2,72 altı kayıt silme.
      params: { threshold: 2.72, floor: 2.5, allowedStrikes: 1 },
    },
    { code: 'KR-ÇAP-12', kind: 'FROZEN_WITH_MAIN', article: `${CAP} m.9/1-ç`, title: 'Ana dalla birlikte dondurma', appliesTo: 'CAP', phase: 'TERM_END', params: {} },
    {
      code: 'KR-ÇAP-14',
      kind: 'MAX_DURATION',
      article: `${CAP} m.8/1-d, m.9/1-g`,
      title: 'Azami öğrenim süresi',
      appliesTo: 'CAP',
      phase: 'TERM_END',
      // 2547 s. Kanun m.44/c: dört yıllık lisans için azami yedi yıl (14 yarıyıl).
      params: { basis: 'ADMISSION', maxTerms: 14 },
    },
    {
      code: 'KR-ÇAP-18',
      kind: 'PROTOCOL_TOTAL_ECTS',
      article: `${CAP} m.7/2`,
      title: 'Ders listesi AKTS toplamı',
      appliesTo: 'CAP',
      phase: 'PROTOCOL',
      params: { byLevel: { ONLISANS: 120, '4': 240 } },
    },
    { code: 'KR-ÇAP-13', kind: 'GRADUATION_CAP', article: `${CAP} m.7/2, m.8/1-c,ç`, title: 'Çift ana dal diploması', appliesTo: 'CAP', phase: 'GRADUATION', params: { minMainGano: 2.72 } },
  ],
};

/** Selçuk Üniversitesi Yan Dal Yönergesi (Senato 26/10/2023, 2023-131). */
export const YANDAL_RULE_SET_V1: RuleSetDefinition = {
  version: 'YANDAL-2023.4',
  type: 'YANDAL',
  effectiveFrom: '2023-10-26',
  rules: [
    { code: 'KR-YD-06', kind: 'MAIN_GANO_BELOW', article: `${YD} m.7/5`, title: 'Ana dal GNO alt sınırı', appliesTo: 'YANDAL', phase: 'TERM_END', params: { min: 2.3, warnMargin: 0.15 } },
    { code: 'KR-YD-07', kind: 'TRACK_GPA_CONSECUTIVE_BELOW', article: `${YD} m.7/6`, title: 'Yan dal ortalaması', appliesTo: 'YANDAL', phase: 'TERM_END', params: { min: 2.0, terms: 2 } },
    { code: 'KR-YD-08', kind: 'CONSECUTIVE_TERMS_NO_COURSE', article: `${YD} m.7/4`, title: 'Üst üste ders almama', appliesTo: 'YANDAL', phase: 'TERM_END', params: { terms: 2 } },
    { code: 'KR-YD-12', kind: 'FROZEN_WITH_MAIN', article: `${YD} m.7/2`, title: 'Ana dalla birlikte izin', appliesTo: 'YANDAL', phase: 'TERM_END', params: {} },
    { code: 'KR-YD-14', kind: 'MAX_DURATION', article: `${YD} m.7/9`, title: 'Mezuniyet sonrası ek süre', appliesTo: 'YANDAL', phase: 'TERM_END', params: { basis: 'MAIN_GRADUATION', maxTerms: 2 } },
    { code: 'KR-YD-05', kind: 'MINOR_PLAN_LIMITS', article: `${YD} m.5/1-g`, title: 'Yan dal ders listesi', appliesTo: 'YANDAL', phase: 'PROTOCOL', params: { minEcts: 30, minCourses: 6, poolMinEcts: 60 } },
    { code: 'KR-YD-10', kind: 'GRADUATION_MINOR', article: `${YD} m.7/8`, title: 'Yan dal sertifikası', appliesTo: 'YANDAL', phase: 'GRADUATION', params: { minTrackGpa: 2.0 } },
  ],
};

export const DEFAULT_RULE_SETS = [CAP_RULE_SET_V1, YANDAL_RULE_SET_V1];
