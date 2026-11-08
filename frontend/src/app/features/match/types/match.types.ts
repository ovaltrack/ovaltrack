import { UUID } from './common.types';

export interface MatchOpponent {
  id: UUID;
  name: string;
  alias: string;
  city: string | null;
}

/** Respuesta de un partido según el contrato consumido por la interfaz. */
export interface Match {
  id: string;
  date: string;
  divisionId: UUID;
  opponent: MatchOpponent;
  status: MatchStatus;
  currentPeriod: number;
  clockElapsedSeconds: number;
  clockPaused: boolean;
  clockUpdatedAt?: string | null;
  currentPossession: 'OWN' | 'OPPONENT' | 'NEUTRAL';
  homeScore: number;
  awayScore: number;
  startedAt?: string | null;
  finishedAt?: string | null;
}

/** Respuesta JSON de un partido según MatchResponseDTO. */
export interface BackendMatchResponse {
  id: UUID;
  date: string | null;
  divisionId: UUID; 
  opponent: MatchOpponent | null;
  status: 'EMPTY_ROSTER' | 'NOT_STARTED' | 'IN_PROGRESS' | 'HALFTIME' | 'FINISHED' | 'CANCELLED';
  currentPeriod: number;
  clockElapsedSeconds: number;
  clockPaused: boolean;
  clockUpdatedAt?: string | null;
  currentPossession: 'OWN' | 'OPPONENT' | 'NEUTRAL';
  homeScore: number;
  awayScore: number;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface LiveMatchStateRequest {
  clockElapsedSeconds: number;
  clockPaused: boolean;
  currentPossession: 'OWN' | 'OPPONENT' | 'NEUTRAL';
}

/** Datos mínimos necesarios para dar de alta un partido nuevo. */
export interface NewMatchDraft {
  date: string;
  opponentId: string;
}

/** Estados posibles de un partido en el listado. */
export type MatchStatus = 'empty_roster' | 'not_started' | 'in_progress' | 'halftime' | 'finished' | 'cancelled';

/**
 * Estados de los partidos que se guardan en IndexedDB para usarse sin conexión: los que todavía se
 * pueden capturar (carga en vivo, entretiempo). Los demás se leen siempre del backend.
 */
const OFFLINE_MATCH_STATUSES: readonly MatchStatus[] = ['not_started', 'in_progress', 'halftime'];

/** Si el partido se guarda en IndexedDB para usarse sin conexión (ver `OFFLINE_MATCH_STATUSES`). */
export function isOfflineMatch(match: Pick<Match, 'status'>): boolean {
  return OFFLINE_MATCH_STATUSES.includes(match.status);
}

/** Duración reglamentaria de un tiempo: el 2° tiempo arranca en este segundo del reloj de juego. */
export const HALF_DURATION_SECONDS = 40 * 60;

export type PendingMatchAction = 'start' | 'close-first-half' | 'start-second-half' | 'finish';

/** Cuerpo opcional de PUT /matches/{id}/start|finish según MatchTransitionDTO. */
export interface MatchTransitionRequest {
  /** Momento real de la transición (ISO-8601 UTC); el servidor lo usa para startedAt/finishedAt. */
  occurredAt?: string;
}

export interface PendingMatchMutation {
  id: string;
  matchId: string;
  action: PendingMatchAction;
  createdAt: number;
  payload?: Record<string, unknown> | null;
}

/** Filtro del listado: todos los estados más la opción "ver todos". */
export type MatchFilter = MatchStatus | 'all';

/** Filtros disponibles, en el orden en que se renderizan en el control segmentado. */
export const MATCH_FILTERS: readonly MatchFilter[] = ['all', 'empty_roster', 'not_started', 'in_progress', 'halftime', 'finished', 'cancelled'] as const;

/** Etiquetas legibles para cada estado/filtro. */
export const MATCH_STATUS_LABELS: Record<MatchFilter, string> = {
  all: 'Todos',
  empty_roster: 'Sin plantel',
  not_started: 'No iniciado',
  in_progress: 'En progreso',
  halftime: 'Entretiempo',
  finished: 'Finalizado',
  cancelled: 'Cancelados',
};