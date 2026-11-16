import { Match } from '../../match/types/match.types';
import { shortTeamName } from '../../match/post-match/utils/zone-grid';
import { finishedInPlayOrder, playedAt } from './division-match-state';

export type FormResult = 'win' | 'draw' | 'loss';

export interface FormEntry {
  matchId: string;
  result: FormResult;
  /** "24-17": marcador propio primero. */
  score: string;
  opponent: string;
}

export interface FormRecord {
  wins: number;
  draws: number;
  losses: number;
  /** Tantos a favor menos tantos en contra de toda la temporada. */
  diff: number;
  /** Tantos a favor por partido de la temporada, con 1 decimal. */
  averageFor: number;
  /** Tantos en contra por partido de la temporada, con 1 decimal. */
  averageAgainst: number;
  /** Últimos partidos jugados, del más viejo al más reciente. */
  last: FormEntry[];
}

export const FORM_LAST_COUNT = 5;

export type FormMatch = Pick<Match, 'id' | 'date' | 'status' | 'homeScore' | 'awayScore' | 'opponent' | 'finishedAt'>;

const round1 = (value: number) => Math.round(value * 10) / 10;

export function resultOf(ownScore: number, opponentScore: number): FormResult {
  return ownScore > opponentScore ? 'win' : ownScore < opponentScore ? 'loss' : 'draw';
}

/** Partidos FINISHED de la temporada (año en que se jugaron) en el orden en que se jugaron; el club siempre es local: `homeScore` es el propio. */
export function finishedOfSeason<T extends FormMatch>(matches: readonly T[], now: Date): T[] {
  return finishedInPlayOrder(matches).filter(match => playedAt(match)?.getFullYear() === now.getFullYear());
}

/** Récord G-E-P, diferencia, promedios a favor y en contra y últimos 5; `null` si todavía no se jugó ningún partido de la temporada. */
export function formRecord(matches: readonly FormMatch[], now: Date): FormRecord | null {
  const finished = finishedOfSeason(matches, now);
  if (finished.length === 0) return null;
  const results = finished.map(match => resultOf(match.homeScore, match.awayScore));
  return {
    wins: results.filter(result => result === 'win').length,
    draws: results.filter(result => result === 'draw').length,
    losses: results.filter(result => result === 'loss').length,
    diff: finished.reduce((sum, match) => sum + match.homeScore - match.awayScore, 0),
    averageFor: round1(finished.reduce((sum, match) => sum + match.homeScore, 0) / finished.length),
    averageAgainst: round1(finished.reduce((sum, match) => sum + match.awayScore, 0) / finished.length),
    last: finished.slice(-FORM_LAST_COUNT).map(match => ({
      matchId: match.id,
      result: resultOf(match.homeScore, match.awayScore),
      score: `${match.homeScore}-${match.awayScore}`,
      opponent: shortTeamName(match.opponent.alias || match.opponent.name)
    }))
  };
}
