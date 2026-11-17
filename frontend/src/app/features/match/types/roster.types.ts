import { BackendMatchResponse, Match } from './match.types';

export interface AvailablePlayer {
  id: string;
  fullName: string;
  jerseyNumber: number | null;
  position: string | null;
}

export type RosterStep = 'titulares' | 'suplentes';

export type RugbyPositionCategory =
  | 'primera_linea'
  | 'segunda_linea'
  | 'tercera_linea'
  | 'medios'
  | 'backs'
  | 'suplente';

export interface RugbySlotDefinition {
  readonly number: number;
  readonly positionName: string;
  readonly positionCategory: RugbyPositionCategory;
  readonly isStarter: boolean;
}

export interface RosterSlot {
  readonly number: number;
  matchNumber: number | null;
  readonly positionName: string;
  readonly positionCategory: RugbyPositionCategory;
  readonly isStarter: boolean;
  player: AvailablePlayer | null;
}

export interface RosterValidationResult {
  readonly isValid: boolean;
  readonly startingCount: number;
  readonly substituteCount: number;
  readonly missingStartingCount: number;
  readonly message?: string;
}

export interface RosterBootstrapResponse {
  match: BackendMatchResponse;
  players: AvailablePlayer[];
  roster: MatchRosterPlayer[];
}

export interface RosterBootstrap {
  match: Match;
  players: AvailablePlayer[];
  roster: SavedRoster;
}

export interface RosterPayload {
  matchId: string;
  titulares: RosterEntry[];
  suplentes: RosterEntry[];
}

export interface SaveRosterRequestDTO {
  titulares: RosterEntry[];
  suplentes: RosterEntry[];
}

export interface RosterEntry {
  playerId: string;
  number: number;
  role?: 'TITULAR' | 'SUPLENTE';
  fieldStatus?: 'EN_CANCHA' | 'EN_BANCO';
  fieldSlot?: number | null;
  slotOrder?: number | null;
}

export interface MatchRosterPlayer {
  id: string;
  fullName: string;
  position: string | null;
  number: number;
  role: 'TITULAR' | 'SUPLENTE';
  fieldStatus: 'EN_CANCHA' | 'EN_BANCO';
  fieldSlot: number | null;
  slotOrder: number | null;
}

export interface BackendRosterResponse {
  startingPlayers?: string[];
  substitutePlayers?: string[];
  titularesIds?: string[];
  suplentesIds?: string[];
}

export interface SavedRoster {
  startingPlayers: RosterEntry[];
  substitutePlayers: RosterEntry[];
}