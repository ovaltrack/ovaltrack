import { MatchTimelineEventResponse } from '../../types/event.types';

export type CoverageEvent = Pick<MatchTimelineEventResponse, 'eventTypeId' | 'playerId' | 'teamPossession'>;

export interface ReviewCoverage {
  totalEvents: number;
  /** Jugadas propias o neutrales sin jugador asignado. */
  unassigned: number;
  /** 0–100, redondeado; un partido sin eventos cuenta como 100. */
  percent: number;
}

/** Ids de los tipos activos del catálogo; sin catálogo (vacío) devuelve `null`: no se filtra nada. */
export function activeTypeIdsOf(types: readonly { id: string; isActive?: boolean }[]): ReadonlySet<string> | null {
  return types.length === 0 ? null : new Set(types.filter(type => type.isActive !== false).map(type => type.id));
}

/** Una jugada está "sin jugador" si no tiene `playerId` y no es del rival (`OPPONENT` nunca lleva jugador del plantel). */
export function isUnassignedEvent(event: Pick<CoverageEvent, 'playerId' | 'teamPossession'>): boolean {
  return !event.playerId?.trim() && event.teamPossession !== 'OPPONENT';
}

/** Los eventos que se revisan: se descartan los de tipos dados de baja o que el catálogo ya no devuelve. */
export function reviewableEvents<T extends Pick<CoverageEvent, 'eventTypeId'>>(events: readonly T[], activeTypeIds: ReadonlySet<string> | null): T[] {
  return activeTypeIds === null ? [...events] : events.filter(event => activeTypeIds.has(event.eventTypeId));
}

/** Porcentaje de jugadas con jugador asignado; sin jugadas es 100. */
export function coveragePercent(totalEvents: number, unassigned: number): number {
  return totalEvents > 0 ? Math.round(((totalEvents - unassigned) / totalEvents) * 100) : 100;
}

/** Cobertura de análisis de un partido: la única definición, la usan post-partido y el Inicio. */
export function reviewCoverage(events: readonly CoverageEvent[], activeTypeIds: ReadonlySet<string> | null): ReviewCoverage {
  const reviewed = reviewableEvents(events, activeTypeIds);
  const unassigned = reviewed.filter(isUnassignedEvent).length;
  return { totalEvents: reviewed.length, unassigned, percent: coveragePercent(reviewed.length, unassigned) };
}
