import { Match } from '../../match/types/match.types';
import { shortTeamName } from '../../match/post-match/utils/zone-grid';
import { BoardModel, BoardWeek, LiveEventLine } from '../types/home.types';
import { gameWeek } from './game-week';
import { rosterGaps } from './roster-gaps';
import { MATCH_DAY_WINDOW_MS } from './countdown';
import { DivisionMatchState, divisionMatchState, playedAt } from './division-match-state';
import { resultOf } from './form-record';
import { clockLabel, dayLabel, daysUntilLabel, formatUtcAsArgentina, msUntil, parseWallClock, relativeMatchLabel, shortDateLabel, weekdayName } from './match-time';

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
  /** Análisis del último partido jugado; `null` si no hay o no se pudo leer. */
  analysis: { percent: number; withoutPlayer: number; minutesWithoutZone: number | null } | null;
}

const opponentName = (match: Match) => shortTeamName(match.opponent.alias || match.opponent.name);

/** "2T 52'": período y minuto de juego guardados; sin ellos, el período del partido. */
export function periodText(match: Match, progress: CoachBoardContext['progress']): string {
  if (match.status === 'halftime') return 'Entretiempo';
  if (progress) return `${progress.periodLabel} ${progress.gameClock.split(':')[0]}'`;
  return match.currentPeriod === 2 ? '2T' : '1T';
}

/**
 * Período y minuto de un partido que captura otro dispositivo: "2T 52'". El minuto es el último dato sincronizado
 * (`clockElapsedSeconds` acumulado de partido), sin extrapolar; va junto con la hora del último dato.
 */
export function remotePeriodText(match: Match): string {
  if (match.status === 'halftime') return 'Entretiempo';
  return `${match.currentPeriod === 2 ? '2T' : '1T'} ${Math.floor(match.clockElapsedSeconds / 60)}'`;
}

/** La semana de juego del tablero; `null` si no hay pasos (sin partido por jugar ni análisis pendiente). */
function boardWeek(ctx: CoachBoardContext, state: DivisionMatchState<Match>): BoardWeek | null {
  const last = state.lastFinished;
  const week = gameWeek({
    state,
    analysis: ctx.analysis && last ? { opponent: opponentName(last), percent: ctx.analysis.percent, minutesWithoutZone: ctx.analysis.minutesWithoutZone } : null,
    roster: ctx.roster,
    now: ctx.now
  });
  return week && { stage: week.stage, label: `Semana de juego · ${ctx.divisionName} · paso ${week.stepNumber} de 4`, steps: week.steps };
}

const RESULT_WORD = { win: 'Ganado', draw: 'Empatado', loss: 'Perdido' } as const;

/** Cómo está la nómina del próximo partido, en una frase corta para el panel «Después». */
function rosterNote(roster: CoachBoardContext['roster'], next: Match): string | null {
  const gaps = rosterGaps(roster, next.status);
  if (gaps.kind === 'unknown') return null;
  if (gaps.kind === 'complete') return 'nómina lista';
  return gaps.kind === 'none' ? 'nómina sin armar todavía' : gaps.label.toLowerCase();
}

/** Variante «Cerrá el análisis»: el último partido jugado todavía tiene jugadas sin jugador o minutos sin zona. */
function analysisBoard(ctx: CoachBoardContext, last: Match, analysis: NonNullable<CoachBoardContext['analysis']>, next: Match | null, week: BoardWeek | null): BoardModel {
  const played = playedAt(last);
  const nextStart = next ? parseWallClock(next.date) : null;
  const result = resultOf(last.homeScore, last.awayScore);
  const subtitle = [`vs ${opponentName(last)}`, `${RESULT_WORD[result]} ${last.homeScore}–${last.awayScore}`, played ? dayLabel(played) : ''].filter(Boolean).join(' · ');
  const nextNote = next ? rosterNote(ctx.roster, next) : null;
  return {
    kind: 'analysis',
    matchId: last.id,
    divisionName: ctx.divisionName,
    title: played ? `Cerrá el análisis del ${weekdayName(played)}` : 'Cerrá el análisis',
    subtitle,
    percent: analysis.percent,
    withoutPlayer: analysis.withoutPlayer,
    minutesWithoutZone: analysis.minutesWithoutZone,
    after: next && nextStart
      ? { title: `vs ${opponentName(next)} · ${dayLabel(nextStart)} · ${clockLabel(nextStart)}`, detail: [daysUntilLabel(nextStart, ctx.now), nextNote].filter(Boolean).join(' · ') }
      : null,
    week
  };
}

/** Elige la variante del tablero del entrenador: en curso, día de partido, próximo, sin partido programado o primeros pasos. */
export function buildCoachBoard(ctx: CoachBoardContext): BoardModel {
  const state = divisionMatchState(ctx.matches, ctx.captureMatchId, ctx.now);
  const { live, liveHere, next, lastFinished } = state;
  const week = boardWeek(ctx, state);
  if (live) {
    if (liveHere) {
      return {
        kind: 'live-here', matchId: live.id, opponent: opponentName(live), periodLabel: periodText(live, ctx.progress),
        ownScore: live.homeScore, opponentScore: live.awayScore, halftime: live.status === 'halftime', recent: [...ctx.recent], week
      };
    }
    return {
      kind: 'live-elsewhere', matchId: live.id, opponent: opponentName(live), periodLabel: remotePeriodText(live), ownScore: live.homeScore, opponentScore: live.awayScore,
      lastDataAt: live.clockUpdatedAt ? formatUtcAsArgentina(live.clockUpdatedAt) : null, week
    };
  }

  if (week?.stage === 'analyze' && lastFinished && ctx.analysis) return analysisBoard(ctx, lastFinished, ctx.analysis, next, week);

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
    return { kind: 'match-day', matchId: next.id, divisionName: ctx.divisionName, opponent: opponentName(next), startsAt: start, starters, substitutes, week };
  }
  const label = relativeMatchLabel(start, ctx.now);
  const parts = label.split(' · ');
  return {
    kind: 'next', matchId: next.id, divisionName: ctx.divisionName, opponent: opponentName(next), city: next.opponent.city,
    dateLabel: parts.slice(0, -1).join(' · '), time: parts[parts.length - 1], starters, substitutes,
    rosterGaps: rosterGaps(ctx.roster, next.status), readyOffline: ctx.readyOffline, week
  };
}
