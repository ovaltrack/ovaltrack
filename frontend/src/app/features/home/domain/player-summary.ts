import { shortTeamName } from '../../match/post-match/utils/zone-grid';
import { PlayerMatchDTO, PlayerMatchStatistic } from '../../player-statistics/types/player-statistics.types';
import { toResult, valueByCode } from '../../player-statistics/utils/player-statistics.utils';
import { playedAt } from './division-match-state';
import { dayLabel, parseWallClock } from './match-time';

export interface PlayerLastMatch {
  matchId: string;
  dateLabel: string;
  opponent: string;
  ownScore: number;
  opponentScore: number;
  result: 'win' | 'loss' | 'draw';
  role: 'TITULAR' | 'SUPLENTE';
  /** `null` mientras el análisis está incompleto y todavía no hay ninguno: un 0 ahí es solo "no cargado". */
  tries: number | null;
  /** Tackles hechos. */
  tackles: number | null;
  /** Efectividad de tackle del partido; `null` si no intentó ninguno o si los tackles todavía no se cargaron. */
  tacklePercent: number | null;
  slotNumber: number | null;
  /** % de jugadas del partido con jugador asignado. */
  analysisPercent: number;
}

export interface PlayerSummary {
  last: PlayerLastMatch;
}

/** Con el análisis incompleto, un 0 no es un dato: puede ser una acción que todavía nadie asignó. */
const provisionalZero = (value: number, analysisPercent: number): number | null =>
  value === 0 && analysisPercent < 100 ? null : value;

const count = (stat: PlayerMatchStatistic, code: string) => valueByCode(stat.stat, stat.columns, code).count;

const playedTime = (match: PlayerMatchDTO): number => playedAt(match)?.getTime() ?? 0;

/** El partido que se jugó más tarde (`finishedAt`, o la fecha si falta); el orden del servicio es por fecha programada. `null` sin partidos. */
export function latestMatchOf(matches: readonly PlayerMatchDTO[]): PlayerMatchDTO | null {
  return [...matches].sort((a, b) => playedTime(b) - playedTime(a))[0] ?? null;
}

/**
 * Resumen del jugador a partir de las estadísticas de su último partido (ver `latestMatchOf`; un terminado con fecha futura
 * cuenta como jugado). `analysisPercent` es el de ese partido. `null` si todavía no jugó ninguno.
 */
export function buildPlayerSummary(latest: PlayerMatchStatistic | null, analysisPercent: number): PlayerSummary | null {
  if (!latest) return null;

  const { match } = latest;
  const start = parseWallClock(match.date);
  const tacklesMade = count(latest, 'TACKLE_MADE');
  const tackleAttempts = tacklesMade + count(latest, 'TACKLE_MISSED');
  const tackles = provisionalZero(tacklesMade, analysisPercent);

  return {
    last: {
      matchId: match.matchId,
      dateLabel: start ? dayLabel(start) : '',
      opponent: shortTeamName(match.opponentName),
      ownScore: match.homeScore,
      opponentScore: match.awayScore,
      result: toResult(match),
      role: match.role,
      tries: provisionalZero(count(latest, 'TRY'), analysisPercent),
      tackles,
      tacklePercent: tackles === null || tackleAttempts === 0 ? null : Math.round((tacklesMade / tackleAttempts) * 100),
      slotNumber: match.slotNumber,
      analysisPercent
    }
  };
}
