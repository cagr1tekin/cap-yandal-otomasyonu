import type { Proposal } from '@cap/contracts';

export interface Rankable {
  id: string;
  gano: number;
  classRankPercentile: number | null;
  submittedAt: Date;
}

export interface Ranked {
  id: string;
  score: number;
  rank: number;
  proposal: Proposal;
}

/** Sıralama stratejisi (teknik doküman 8.3). AS-2 yanıtlanınca teklif bazında seçilebilir hâle gelir. */
export interface RankingStrategy {
  name: string;
  score(a: Rankable): number;
  tieBreak(a: Rankable, b: Rankable): number;
}

/** Varsayılan: GNO azalan; eşitlikte sınıf yüzdeliği artan; o da eşitse erken başvuru. */
export const GanoThenRank: RankingStrategy = {
  name: 'GNO, sonra sınıf başarı sırası',
  score: (a) => a.gano,
  tieBreak: (a, b) =>
    (a.classRankPercentile ?? 101) - (b.classRankPercentile ?? 101) || a.submittedAt.getTime() - b.submittedAt.getTime(),
};

export function rank(apps: Rankable[], quota: number, waitlistSize: number, strategy = GanoThenRank): Ranked[] {
  return [...apps]
    .sort((a, b) => strategy.score(b) - strategy.score(a) || strategy.tieBreak(a, b))
    .map((a, i) => ({
      id: a.id,
      score: strategy.score(a),
      rank: i + 1,
      proposal: i < quota ? 'ASIL' : i < quota + waitlistSize ? 'YEDEK' : 'RET',
    }));
}
