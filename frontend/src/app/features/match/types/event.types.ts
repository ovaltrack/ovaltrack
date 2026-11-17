import { UUID } from './common.types';
import { Possession } from './live-capture.types';

export interface BackendEventResponse {
  id: UUID;
  clientEventId?: UUID | null;
  eventTypeId: UUID;
  matchId: UUID;
  playerId: UUID | null;
  teamPossession: Possession;
  matchTime: number | null;
  absoluteMatchTime: number | null;
  realTime: string | null;
  period: number | null;
  origin: string | null;
  attributes: Record<string, unknown> | null;
  createdAt: string;
  synchronizedAt: string | null;
  active: boolean;
  note?: string | null;
}

export interface BackendEventCreationRequest {
  eventTypeId: UUID;
  matchId: UUID;
  clientEventId?: UUID | null;
  playerId?: UUID | null;
  teamPossession?: Possession | null;
  matchTime?: number | null;
  absoluteMatchTime?: number | null;
  realTime?: string | null;
  period?: number | null;
  origin?: string | null;
  attributes?: Record<string, unknown>;
  synchronizedAt?: string | null;
  note?: string | null;
}

export interface BackendEventUpdateRequest {
  eventTypeId?: UUID | null;
  playerId?: UUID | null;
  teamPossession?: Possession | null;
  matchTime?: number | null;
  absoluteMatchTime?: number | null;
  period?: number | null;
  origin?: string | null;
  attributes?: Record<string, unknown> | null;
  synchronizedAt?: string | null;
  note?: string | null;
}

export interface LocalMatchEvent extends BackendEventResponse {
  backendEventId?: UUID | null;
  localSequence: number;
  /** Intentos de sincronización fallidos. Solo local, no se envía al backend. */
  syncAttempts?: number;
  /** Momento en que el servidor rechazó el evento; a partir de ahí no se reintenta automáticamente. */
  syncFailedAt?: string | null;
  syncErrorMessage?: string | null;
}

export interface MatchTimelineEventResponse {
  id: string;
  eventTypeId: string;
  eventTypeName: string;
  playerId?: string | null;
  playerName?: string | null;
  playerJerseyNumber?: number | null;
  matchTime: number;
  absoluteMatchTime?: number | null;
  realTime?: string | null;
  period: number;
  teamPossession: Possession;
  origin?: string | null;
  attributes?: Record<string, unknown> | null;
  note?: string | null;
  /** Zona de la cancha derivada del período asignado; null/ausente = sin zona. */
  zone?: { row: number; col: number } | null;
}