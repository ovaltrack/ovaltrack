import { MatchTimelineEventResponse } from '../../types/event.types';
import { ZoneAssignmentResponse, ZoneCellRef } from '../../types/zone.types';
import { ZoneRulesByType } from './zone-rule';
import { ZonePeriodFilter } from './zone-stats';

/** Una jugada de la celda para el detalle: cuándo, qué, de quién y de dónde sale su zona. */
export interface CellEventRow {
  id: string;
  clock: string;
  typeName: string;
  team: string;
  origin: string;
}

/** Un tramo de la celda para el detalle del modo Minutos. */
export interface CellTramoRow {
  id: string;
  label: string;
  minutes: number;
}

export type CellDetailEvent = Pick<MatchTimelineEventResponse,
  'id' | 'eventTypeId' | 'eventTypeName' | 'period' | 'matchTime' | 'teamPossession' | 'attributes' | 'zone'>;

/** Jugadas cuya zona es la celda, del tiempo elegido y en orden cronológico. */
export function cellEventRows(
  events: CellDetailEvent[], cell: ZoneCellRef, assignments: ZoneAssignmentResponse[], rules: ZoneRulesByType, filter: ZonePeriodFilter
): CellEventRow[] {
  return [];
}

/** Tramos asignados a la celda, del tiempo elegido y en orden cronológico. */
export function cellTramoRows(assignments: ZoneAssignmentResponse[], cell: ZoneCellRef, filter: ZonePeriodFilter): CellTramoRow[] {
  return [];
}
