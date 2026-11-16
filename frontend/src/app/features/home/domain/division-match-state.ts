import { Match } from '../../match/types/match.types';
import { parseBackendInstant, parseWallClock } from './match-time';
import { RuleMatch, upcomingMatches } from './primary-action';

export type StateMatch = RuleMatch & { finishedAt?: string | null };

/** El estado del servidor manda sobre la fecha: en curso es `in_progress` o `halftime`, sea cual sea su fecha. */
export const isLiveMatch = (match: Pick<Match, 'status'>): boolean => match.status === 'in_progress' || match.status === 'halftime';

/** Cuándo se jugó de verdad: `finishedAt` y, si falta o no se lee, la fecha programada. */
export function playedAt(match: StateMatch): Date | null {
  return (match.finishedAt ? parseBackendInstant(match.finishedAt) : null) ?? parseWallClock(match.date);
}

/** Partidos FINISHED en el orden en que se jugaron (el más viejo primero). Uno terminado con fecha futura cuenta como jugado. */
export function finishedInPlayOrder<T extends StateMatch>(matches: readonly T[]): T[] {
  return matches
    .flatMap(match => {
      const played = match.status === 'finished' ? playedAt(match) : null;
      return played ? [{ match, played }] : [];
    })
    .sort((a, b) => a.played.getTime() - b.played.getTime())
    .map(entry => entry.match);
}

export interface DivisionMatchState<T extends StateMatch> {
  /** Partido en curso, acá o en otro dispositivo; si hay más de uno, el que captura este dispositivo. */
  live: T | null;
  /** El partido en curso lo captura este dispositivo. */
  liveHere: boolean;
  /** Partidos por jugar, el más cercano primero. */
  upcoming: T[];
  next: T | null;
  /** Último partido jugado según `playedAt`; `null` si todavía no se jugó ninguno. */
  lastFinished: T | null;
}

/** Única fuente del estado de los partidos de una división: tablero, tarjetas y reglas del CTA la consumen. */
export function divisionMatchState<T extends StateMatch>(matches: readonly T[], captureMatchId: string | null, now: Date): DivisionMatchState<T> {
  const live = matches.find(match => isLiveMatch(match) && match.id === captureMatchId) ?? matches.find(isLiveMatch) ?? null;
  const upcoming = upcomingMatches(matches, now);
  return {
    live,
    liveHere: live !== null && live.id === captureMatchId,
    upcoming,
    next: upcoming[0] ?? null,
    lastFinished: finishedInPlayOrder(matches).at(-1) ?? null
  };
}
