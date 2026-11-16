import { shortTeamName } from '../../match/post-match/utils/zone-grid';
import { PlayerMatchStatistic } from '../../player-statistics/types/player-statistics.types';
import { toResult, valueByCode } from '../../player-statistics/utils/player-statistics.utils';
import { FormEntry } from './form-record';
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
  tackles: number | null;
  slotNumber: number | null;
  /** % de jugadas del partido con jugador asignado. */
  analysisPercent: number;
}

export interface PlayerSeason {
  year: number;
  points: number;
  tries: number;
  matches: number;
  starts: number;
  /** Tackles hechos sobre intentados; `null` si no intentó ninguno. */
  tacklePercent: number | null;
  /** Últimos partidos de la temporada, del más viejo al más reciente. */
  last: FormEntry[];
}

export interface PlayerSummary {
  last: PlayerLastMatch;
  season: PlayerSeason;
}

export const PLAYER_LAST_COUNT = 5;

/** Con el análisis incompleto, un 0 no es un dato: puede ser una acción que todavía nadie asignó. */
const provisionalZero = (value: number, analysisPercent: number): number | null =>
  value === 0 && analysisPercent < 100 ? null : value;

const count = (stat: PlayerMatchStatistic, code: string) => valueByCode(stat.stat, stat.columns, code).count;

/**
 * Resumen del jugador a partir de sus partidos (el más reciente primero, como los entrega el servicio).
 * `analysisPercent` es el del último partido. `null` si todavía no jugó ninguno.
 */
export function buildPlayerSummary(statistics: readonly PlayerMatchStatistic[], analysisPercent: number, now: Date): PlayerSummary | null {
  const latest = statistics[0];
  if (!latest) return null;

  const { match } = latest;
  const start = parseWallClock(match.date);
  const tackles = count(latest, 'TACKLE_MADE') + count(latest, 'TACKLE_MISSED');

  const ofSeason = statistics.filter(entry => entry.match.date.slice(0, 4) === String(now.getFullYear()));
  const made = ofSeason.reduce((sum, entry) => sum + count(entry, 'TACKLE_MADE'), 0);
  const attempts = made + ofSeason.reduce((sum, entry) => sum + count(entry, 'TACKLE_MISSED'), 0);

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
      tackles: provisionalZero(tackles, analysisPercent),
      slotNumber: match.slotNumber,
      analysisPercent
    },
    season: {
      year: now.getFullYear(),
      points: ofSeason.reduce((sum, entry) => sum + entry.stat.totalPoints, 0),
      tries: ofSeason.reduce((sum, entry) => sum + count(entry, 'TRY'), 0),
      matches: ofSeason.length,
      starts: ofSeason.filter(entry => entry.match.role === 'TITULAR').length,
      tacklePercent: attempts === 0 ? null : Math.round((made / attempts) * 100),
      last: ofSeason.slice(0, PLAYER_LAST_COUNT).reverse().map(entry => ({
        matchId: entry.match.matchId,
        result: toResult(entry.match),
        score: `${entry.match.homeScore}-${entry.match.awayScore}`,
        opponent: shortTeamName(entry.match.opponentName)
      }))
    }
  };
}
