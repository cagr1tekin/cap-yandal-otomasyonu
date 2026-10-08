import { course } from './catalog';

/**
 * Kabul ve Ders Protokolü şablonları.
 *
 * GERÇEK: iki ÇAP protokolü bölümün "Çift Anadal" sayfasındaki belgelerden bire bir alınmıştır
 * (kaynaklar/bolum-sitesi/protokol-eem-bilgisayar.pdf, protokol-makine-bilgisayar.pdf):
 * ders listesi, seçmeli ders yerleri, AKTS toplamı (135 ve 171) ve numaralı özel şartlar.
 * Ortak AKTS, yönergedeki 240 AKTS'den (ÇAP Yön. m.7/2) protokol toplamı çıkarılarak bulunmuştur;
 * protokol belgesinde ortak dersler listelenmez (Rehber, "Protokol ve Özel Şartlar").
 *
 * TEMSİLÎ: yan dal havuzu. Bölümün yayımlanmış bir yan dal ders listesi bulunamadı; havuz gerçek
 * müfredat derslerinden örnek olarak kurulmuştur ve bölüm kurulu kararıyla değiştirilmelidir.
 */

export interface SeedTemplateItem {
  kind: 'COURSE' | 'ELECTIVE_SLOT';
  code: string | null;
  name: string;
  ects: number;
  semester: number;
}

export interface SeedCondition {
  no: number;
  sourceCourseCode: string;
  sourceCourseName: string;
  targetCourseCode: string;
  note?: string;
}

export interface SeedTemplate {
  id: string;
  type: 'CAP' | 'YANDAL';
  sourceProgramId: string | null;
  title: string;
  commonEcts: number;
  source: string;
  items: SeedTemplateItem[];
  conditions: SeedCondition[];
}

const c = (code: string): SeedTemplateItem => {
  const x = course(code);
  return { kind: 'COURSE', code, name: x.name, ects: x.ects, semester: x.semester };
};

const slots = (semester: number, count: number): SeedTemplateItem[] =>
  Array.from({ length: count }, () => ({ kind: 'ELECTIVE_SLOT' as const, code: null, name: `${semester}. Yarıyıl Teknik Seçmeli Ders`, ects: 4, semester }));

const CLOSING = [c('3301851'), c('3301852'), c('3301853')];
const OPEN_NOTE = 'Öğrencinin Bilgisayar Mühendisliği Bölümünde dersi aldığı dönem ilgili dersin açılması kaydıyla';

export const TEMPLATES: SeedTemplate[] = [
  {
    id: 'PT-CAP-EEM',
    type: 'CAP',
    sourceProgramId: 'P-EEM',
    title: 'Elektrik-Elektronik Mühendisliğinden Bilgisayar Mühendisliğine',
    commonEcts: 105,
    source: 'Bölüm sitesi: Protokol - Elektrik-Elektronikten Bilgisayara (4/6/2026)',
    items: [
      c('3301156'), c('3301351'), c('3301352'), c('3301354'), c('3301452'), c('3301454'), c('3301455'), c('3301456'),
      c('3301552'), c('3301553'), ...slots(5, 3),
      c('3301651'), c('3301652'), c('3301653'), c('3301654'), ...slots(6, 3),
      c('3301751'), c('3301752'), c('3301753'), ...slots(7, 2),
      ...CLOSING,
    ],
    conditions: [
      { no: 1, sourceCourseCode: '3302458', sourceCourseName: 'Veri Yapıları (4. Yarıyıl Teknik Seçmeli)', targetCourseCode: '3301354' },
      { no: 2, sourceCourseCode: '3302758', sourceCourseName: 'Sayısal Sinyal İşleme (7. Yarıyıl Teknik Seçmeli)', targetCourseCode: '3301561' },
      { no: 3, sourceCourseCode: '3302459', sourceCourseName: 'Mühendislik Veri Madenciliği (4. Yarıyıl Teknik Seçmeli)', targetCourseCode: '3301568' },
      { no: 4, sourceCourseCode: '3302561', sourceCourseName: 'Makine Öğrenmesi ve Yapay Zekâ (5. Yarıyıl Teknik Seçmeli)', targetCourseCode: '3301651' },
      { no: 5, sourceCourseCode: '3302659', sourceCourseName: 'Görüntü İşleme (6. Yarıyıl Teknik Seçmeli)', targetCourseCode: '3301653' },
      { no: 6, sourceCourseCode: '3302656', sourceCourseName: 'Gömülü Sistemler (6. Yarıyıl Teknik Seçmeli)', targetCourseCode: '3301663' },
      { no: 7, sourceCourseCode: '3302563', sourceCourseName: 'Robotik Sistemlere Giriş (5. Yarıyıl Teknik Seçmeli)', targetCourseCode: '3301665' },
      { no: 8, sourceCourseCode: '3302556', sourceCourseName: 'Veri İletişim Teknikleri (5. Yarıyıl Teknik Seçmeli)', targetCourseCode: '3301770' },
    ],
  },
  {
    id: 'PT-CAP-MAK',
    type: 'CAP',
    sourceProgramId: 'P-MAK',
    title: 'Makine Mühendisliğinden Bilgisayar Mühendisliğine',
    commonEcts: 69,
    source: 'Bölüm sitesi: Protokol - Makineden Bilgisayara (4/6/2026)',
    items: [
      c('3301156'), c('3301256'), c('3301258'), c('3301351'), c('3301352'), c('3301353'), c('3301354'), c('3301355'), c('3301357'),
      c('3301452'), c('3301453'), c('3301454'), c('3301455'), c('3301456'),
      c('3301551'), c('3301552'), c('3301553'), ...slots(5, 3),
      c('3301651'), c('3301652'), c('3301653'), c('3301654'), ...slots(6, 3),
      c('3301751'), c('3301752'), c('3301753'), ...slots(7, 3),
      ...CLOSING,
    ],
    conditions: [
      { no: 1, sourceCourseCode: '3303658', sourceCourseName: 'Robotik (6. Yarıyıl Teknik Seçmeli)', targetCourseCode: '3301665', note: OPEN_NOTE },
      { no: 2, sourceCourseCode: '3303781', sourceCourseName: 'Çevre ve Enerji (7. Yarıyıl Teknik Seçmeli)', targetCourseCode: '3301776', note: OPEN_NOTE },
    ],
  },
  {
    id: 'PT-YANDAL',
    type: 'YANDAL',
    sourceProgramId: null,
    title: 'Bilgisayar Mühendisliği Yan Dal Ders Havuzu (örnek)',
    commonEcts: 0,
    source: 'TEMSİLÎ: gerçek müfredat derslerinden örnek havuz; bölüm kurulu belirler',
    items: [
      c('3301156'), c('3301256'), c('3301351'), c('3301352'), c('3301354'), c('3301452'), c('3301454'), c('3301455'),
      c('3301456'), c('3301552'), c('3301553'), c('3301651'), c('3301652'), c('3301653'), c('3301753'),
    ],
    conditions: [],
  },
];

export const templateEcts = (t: SeedTemplate) => t.items.reduce((sum, i) => sum + i.ects, 0);
