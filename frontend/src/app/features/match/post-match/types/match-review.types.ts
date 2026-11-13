import { Possession } from '../../types/live-capture.types';
import { ZoneCellRef } from '../../types/zone.types';

export type ReviewPeriodFilter = 'ALL' | 1 | 2;

export interface ReviewFilters {
  period: ReviewPeriodFilter;
  team: 'ALL' | 'OWN' | 'OPPONENT';
  onlyUnassigned: boolean;
  searchTerm: string;
  hiddenLaneIds: string[];
}

export interface ReviewEventViewModel {
  id: string;
  eventTypeId: string;
  eventTypeName: string;
  color: string;
  period: number;
  matchTime: number; // En segundos acumulados
  minute: number; // Minutos reglamentarios (matchTime / 60)
  pct: number; // Posición porcentual horizontal (0 a 100%)
  matchTimeFormatted: string; // Formato "MM:SS"
  absoluteMatchTime: number; // Segundos continuos desde el inicio (empieza en 0 y sigue contando)
  absoluteTimeFormatted: string; // Formato "MM:SS"
  playerId: string | null;
  playerName: string;
  playerJerseyNumber: number | null;
  hasPlayer: boolean;
  isUnassigned: boolean;
  teamPossession: Possession;
  origin?: string | null;
  isPostMatch: boolean;
  attributes?: Record<string, unknown> | null;
  note?: string | null;
  /** Zona de la cancha del evento; null = sin zona; ausente = no se sabe (el servidor no la informó y no hay tramos cargados). */
  zone?: ZoneCellRef | null;
  /** La zona sale de la regla del tipo y no de un tramo (se muestra "zona fija por el tipo"). */
  zoneFixed?: boolean;
  isDimmed: boolean; // True si queda fuera de los filtros activos (para el gráfico)
}

export interface ReviewTimelineLane {
  eventTypeId: string;
  eventName: string;
  color: string;
  totalCount: number;
  filteredCount: number;
  hidden: boolean;
  isDimmed: boolean;
  occurrences: ReviewEventViewModel[];
}

export interface ReviewKpis {
  totalEvents: number;
  unassignedEvents: number;
  coveragePercentage: number;
  startTimeFormatted: string;
}
