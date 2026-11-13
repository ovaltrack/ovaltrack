import { MatchTimelineEventResponse } from '../../types/event.types';
import { Possession } from '../../types/live-capture.types';
import { ZoneAssignmentResponse, ZoneCellRef } from '../../types/zone.types';
import { ZoneRulesByType, formatMatchTime, isFixedZone } from './zone-rule';
import { ZonePeriodFilter, tramoAtEvent } from './zone-stats';

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

const TEAM_LABEL: Readonly<Record<Possession, string>> = { OWN: 'Propio', OPPONENT: 'Rival', NEUTRAL: 'Neutral' };
const FIXED_ORIGIN = 'Zona fija por el tipo';

const inCell = (zone: ZoneCellRef | null | undefined, cell: ZoneCellRef): boolean => zone?.row === cell.row && zone?.col === cell.col;
const inPeriod = (period: number, filter: ZonePeriodFilter): boolean => filter === 'ALL' || period === filter;

function originOf(event: CellDetailEvent, assignments: ZoneAssignmentResponse[], rules: ZoneRulesByType): string {
  if (isFixedZone(rules.get(event.eventTypeId), event.attributes)) return FIXED_ORIGIN;
  const tramo = tramoAtEvent(event, assignments);
  return tramo ? `Tramo ${tramo.period}T ${tramo.startMinute}'–${tramo.endMinute}'` : '';
}

/** Jugadas cuya zona es la celda, del tiempo elegido y en orden cronológico. */
export function cellEventRows(
  events: CellDetailEvent[], cell: ZoneCellRef, assignments: ZoneAssignmentResponse[], rules: ZoneRulesByType, filter: ZonePeriodFilter
): CellEventRow[] {
  return events
    .filter(event => inCell(event.zone, cell) && inPeriod(event.period, filter))
    .sort((a, b) => a.period - b.period || a.matchTime - b.matchTime)
    .map(event => ({
      id: event.id,
      clock: `${event.period}T ${formatMatchTime(event.matchTime)}`,
      typeName: event.eventTypeName,
      team: TEAM_LABEL[event.teamPossession],
      origin: originOf(event, assignments, rules)
    }));
}

/** Tramos asignados a la celda, del tiempo elegido y en orden cronológico. */
export function cellTramoRows(assignments: ZoneAssignmentResponse[], cell: ZoneCellRef, filter: ZonePeriodFilter): CellTramoRow[] {
  return assignments
    .filter(a => inCell(a, cell) && inPeriod(a.period, filter))
    .sort((a, b) => a.startMinute - b.startMinute)
    .map(a => ({ id: a.id, label: `${a.period}T ${a.startMinute}'–${a.endMinute}'`, minutes: a.endMinute - a.startMinute }));
}
