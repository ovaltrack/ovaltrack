import { PlayerStatColumn, PlayerStatistic } from '../../match/statistics/types/statistic.types';
import { BackendEventResponse } from '../../match/types/event.types';
import { LiveCaptureEventType } from '../../match/types/event-type.types';

/** Resultado de un partido desde la perspectiva del club del jugador. */
export type MatchResult = 'win' | 'loss' | 'draw';

/** Rol del jugador en el plantel del partido. */
export type MatchPlayerRole = 'TITULAR' | 'SUPLENTE';

/** Respuesta de `GET /matches/me`: partido finalizado en el que el jugador estuvo en el plantel. */
export interface PlayerMatchDTO {
  matchId: string;
  date: string;
  opponentName: string;
  divisionName: string;
  /** El club siempre es local: `homeScore` es el marcador propio. */
  homeScore: number;
  awayScore: number;
  role: MatchPlayerRole;
  /** Número de slot en la planilla (titulares 1-15, suplentes 16-23). */
  slotNumber: number | null;
}

/** Datos base de un partido para calcular estadísticas: se cargan una vez por partido. */
export interface PlayerMatchSource {
  events: BackendEventResponse[];
  eventTypes: LiveCaptureEventType[];
}

/** Estadísticas del jugador autenticado en un partido, calculadas desde los eventos. */
export interface PlayerMatchStatistic {
  match: PlayerMatchDTO;
  /** Tipos de evento que requieren jugador, con su `code` y `groupName` del catálogo. */
  columns: PlayerStatColumn[];
  stat: PlayerStatistic;
}

/** Fila del detalle de un partido: una acción que el jugador registró. */
export interface PlayerStatRow {
  label: string;
  /** Por ejemplo "3" o, en acciones con intentos, "2 de 3". */
  value: string;
  /** Efectividad en acciones con intentos; `null` en las demás. */
  percent: number | null;
}

/** Sección del detalle de un partido: una por `groupName` del catálogo, solo con acciones registradas. */
export interface PlayerStatSection {
  title: string;
  rows: PlayerStatRow[];
}

/** Filtro del detalle de un partido: partido completo o un tiempo. */
export type PlayerPeriodFilter = 'ALL' | 1 | 2;

/** Filtro del historial según el rol del jugador en el partido. */
export type PlayerRoleFilter = 'all' | 'starter' | 'substitute';

/** Perfil resumido del jugador autenticado. */
export interface PlayerProfile {
  fullName: string;
  initials: string;
  clubName: string;
  divisionName: string;
}

/** Indicador destacado de la temporada. */
export interface PlayerKpi {
  label: string;
  value: string;
  detail: string;
}

/** Intentos y aciertos de pateo a palos. */
export interface KickingStat {
  label: string;
  made: number;
  attempts: number;
}

/** Métrica simple de juego o disciplina. */
export interface PlayerCountStat {
  label: string;
  value: number;
  tone?: 'warning' | 'error';
}

/** Fila del historial de partidos jugados por el jugador. */
export interface PlayerMatchHistory {
  matchId: string;
  date: string;
  opponent: string;
  result: MatchResult;
  ownScore: number;
  opponentScore: number;
  isStarter: boolean;
  totalPoints: number;
  tries: number;
  conversionsMade: number;
  conversionAttempts: number;
  penaltyKicksMade: number;
  penaltyKickAttempts: number;
  yellowCards: number;
  redCards: number;
  divisionName: string;
}
