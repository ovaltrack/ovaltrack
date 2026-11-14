import { MatchPlayerRole } from './player-statistics.types';

/** Métricas de un jugador en uno o varios partidos (`GET /statistics/player/...`). */
export interface PlayerMetrics {
  points: number;
  tries: number;
  tacklesMade: number;
  tacklesMissed: number;
  conversionsMade: number;
  conversionAttempts: number;
  penaltyKicksMade: number;
  penaltyKickAttempts: number;
  dropGoals: number;
  penaltiesConceded: number;
  turnoversWon: number;
  yellowCards: number;
  redCards: number;
  /** Total de eventos del jugador, de cualquier tipo. */
  actions: number;
}

export type MetricKey =
  | 'points'
  | 'tries'
  | 'tacklesMade'
  | 'tackleEffectiveness'
  | 'goalKickingEffectiveness'
  | 'turnoversWon'
  | 'penaltiesConceded';

export type MetricFormat = 'PER_MATCH' | 'PERCENT';
export type ComparisonVerdict = 'ABOVE' | 'EQUAL' | 'BELOW' | 'NO_DATA';

/** Métrica del jugador frente al promedio del plantel de su división; null sin datos. */
export interface MetricComparison {
  key: MetricKey;
  playerValue: number | null;
  squadValue: number | null;
  format: MetricFormat;
  /** false donde estar por debajo del promedio es lo deseable (penales, errores). */
  higherIsBetter: boolean;
  verdict: ComparisonVerdict;
}

export interface PlayerZoneCell {
  row: number;
  col: number;
  count: number;
}

export interface PlayerZoneMap {
  cells: PlayerZoneCell[];
  zonedEvents: number;
  unzonedEvents: number;
  matchesWithZones: number;
}

/** Cantidad de eventos del jugador de un tipo; `made` solo en los tipos que puntúan. */
export interface PlayerActionCount {
  code: string;
  name: string;
  groupName: string;
  count: number;
  made: number | null;
}

/** Partido finalizado que jugó el jugador. El club siempre es local: `homeScore` es el marcador propio. */
export interface PlayerMatchSummary {
  matchId: string;
  date: string;
  opponentName: string | null;
  homeScore: number;
  awayScore: number;
  role: MatchPlayerRole;
  number: number | null;
  metrics: PlayerMetrics;
}

export interface PlayerDivisionOption {
  divisionId: string;
  name: string;
}

/** Respuesta de `GET /statistics/player/{personId}`. */
export interface PlayerStatisticsResponse {
  personId: string;
  fullName: string;
  divisionId: string | null;
  divisionName: string | null;
  season: number | null;
  seasons: number[];
  divisions: PlayerDivisionOption[];
  matches: PlayerMatchSummary[];
  totals: PlayerMetrics;
  comparisons: MetricComparison[];
  zones: PlayerZoneMap;
  actions: PlayerActionCount[];
}

/** Respuesta de `GET /statistics/player/{personId}/match/{matchId}`. */
export interface PlayerMatchStatisticsResponse {
  personId: string;
  fullName: string;
  divisionId: string;
  divisionName: string;
  match: PlayerMatchSummary;
  squadSize: number;
  comparisons: MetricComparison[];
  zones: PlayerZoneMap;
  actions: PlayerActionCount[];
}

/** Filtros de las estadísticas generales; sin valor, el backend elige la división y temporada más recientes. */
export interface PlayerStatisticsQuery {
  divisionId?: string | null;
  season?: number | null;
}
