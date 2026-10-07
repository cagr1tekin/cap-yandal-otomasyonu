import { rank } from '../src/review/ranking';

const at = (m: number) => new Date(2026, 9, 1, 10, m);

describe('sıralama (GNO, sonra sınıf yüzdeliği, sonra başvuru zamanı)', () => {
  it('GNO azalan; asil/yedek/ret dağılımı', () => {
    const r = rank(
      [
        { id: 'a', gano: 3.1, classRankPercentile: 8, submittedAt: at(1) },
        { id: 'b', gano: 3.6, classRankPercentile: 2, submittedAt: at(2) },
        { id: 'c', gano: 2.9, classRankPercentile: 35, submittedAt: at(3) },
        { id: 'd', gano: 2.8, classRankPercentile: 17, submittedAt: at(4) },
      ],
      2,
      1,
    );
    expect(r.map((x) => [x.id, x.rank, x.proposal])).toEqual([
      ['b', 1, 'ASIL'],
      ['a', 2, 'ASIL'],
      ['c', 3, 'YEDEK'],
      ['d', 4, 'RET'],
    ]);
  });

  it('eşit GNO: önce yüzdelik, sonra erken başvuru; yüzdeliği olmayan sona', () => {
    const r = rank(
      [
        { id: 'late', gano: 3, classRankPercentile: 10, submittedAt: at(9) },
        { id: 'none', gano: 3, classRankPercentile: null, submittedAt: at(0) },
        { id: 'early', gano: 3, classRankPercentile: 10, submittedAt: at(1) },
        { id: 'better', gano: 3, classRankPercentile: 5, submittedAt: at(5) },
      ],
      10,
      0,
    );
    expect(r.map((x) => x.id)).toEqual(['better', 'early', 'late', 'none']);
  });
});
