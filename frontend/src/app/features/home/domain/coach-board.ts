import { Match } from '../../match/types/match.types';
import { shortTeamName } from '../../match/post-match/utils/zone-grid';
import { BoardModel, LiveEventLine } from '../types/home.types';
import { MATCH_DAY_WINDOW_MS } from './countdown';
import { divisionMatchState, playedAt } from './division-match-state';
import { resultOf } from './form-record';
import { formatUtcAsArgentina, msUntil, parseWallClock, relativeMatchLabel, shortDateLabel } from './match-time';

export interface CoachBoardContext {
  now: Date;
  divisionName: string;
  /** Partidos de la división activa. */
  matches: readonly Match[];
  /** Partido que captura este dispositivo, si hay uno. */
  captureMatchId: string | null;
  /** Período y reloj guardados por la captura de este dispositivo. */
  progress: { periodLabel: string; gameClock: string } | null;
  recent: readonly LiveEventLine[];
  roster: { starters: number; substitutes: number } | null;
  readyOffline: boolean;
}

const opponentName = (match: Match) => shortTeamName(match.opponent.alias || match.opponent.name);

/** "2T 52'": período y minuto de juego guardados; sin ellos, el período del partido. */
export function periodText(match: Match, progress: CoachBoardContext['progress']): string {
  if (match.status === 'halftime') return 'Entretiempo';
  if (progress) return `${progress.periodLabel} ${progress.gameClock.split(':')[0]}'`;
  return match.currentPeriod === 2 ? '2T' : '1T';
}

/** Elige la variante del tablero del entrenador: en curso, día de partido, próximo, sin partido programado o primeros pasos. */
export function buildCoachBoard(ctx: CoachBoardContext): BoardModel {
  const { live, liveHere, next, lastFinished } = divisionMatchState(ctx.matches, ctx.captureMatchId, ctx.now);
  if (live) {
    if (liveHere) {
      return {
        kind: 'live-here', matchId: live.id, opponent: opponentName(live), periodLabel: periodText(live, ctx.progress),
        ownScore: live.homeScore, opponentScore: live.awayScore, halftime: live.status === 'halftime', recent: [...ctx.recent]
      };
    }
    return {
      kind: 'live-elsewhere', matchId: live.id, opponent: opponentName(live), ownScore: live.homeScore, opponentScore: live.awayScore,
      lastDataAt: live.clockUpdatedAt ? formatUtcAsArgentina(live.clockUpdatedAt) : null
    };
  }

  const start = next && parseWallClock(next.date);
  if (!next || !start) {
    // Con partidos ya jugados no se "arranca la temporada": solo falta programar el siguiente.
    if (!lastFinished) return { kind: 'onboarding', step: 'schedule-match' };
    const match = lastFinished;
    const played = playedAt(match);
    return {
      kind: 'team-idle',
      divisionName: ctx.divisionName,
      last: {
        opponent: opponentName(match), dateLabel: played ? shortDateLabel(played) : '', ownScore: match.homeScore,
        opponentScore: match.awayScore, result: resultOf(match.homeScore, match.awayScore)
      }
    };
  }

  const starters = ctx.roster?.starters ?? 0;
  const substitutes = ctx.roster?.substitutes ?? 0;
  if (next.status === 'not_started' && msUntil(start, ctx.now) < MATCH_DAY_WINDOW_MS) {
    return { kind: 'match-day', matchId: next.id, divisionName: ctx.divisionName, opponent: opponentName(next), startsAt: start, starters, substitutes };
  }
  const label = relativeMatchLabel(start, ctx.now);
  const parts = label.split(' · ');
  return {
    kind: 'next', matchId: next.id, divisionName: ctx.divisionName, opponent: opponentName(next), city: next.opponent.city,
    dateLabel: parts.slice(0, -1).join(' · '), time: parts[parts.length - 1], starters, substitutes, readyOffline: ctx.readyOffline
  };
}
