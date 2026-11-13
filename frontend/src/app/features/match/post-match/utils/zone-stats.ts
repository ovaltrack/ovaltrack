import { MatchTimelineEventResponse } from '../../types/event.types';
import { Possession } from '../../types/live-capture.types';
import { ZONE_HALF_MINUTES, ZoneAssignmentResponse, ZoneCellSummary, ZonePeriod } from '../../types/zone.types';
import { zoneLabel } from './zone-grid';

export interface MinuteRange {
  start: number;
  end: number;
}

type RangeLike = Pick<ZoneAssignmentResponse, 'period' | 'startMinute' | 'endMinute'>;

/** Minutos de partido que cubre cada tiempo (1T: 0–40, 2T: 40–80). */
export function periodRange(period: ZonePeriod): MinuteRange {
  return { start: (period - 1) * ZONE_HALF_MINUTES, end: period * ZONE_HALF_MINUTES };
}

/** Tramos libres de un tiempo, ordenados. Los rangos son semiabiertos: [inicio, fin). */
export function findGaps(assignments: RangeLike[], period: ZonePeriod): MinuteRange[] {
  const bounds = periodRange(period);
  const taken = assignments
    .filter(a => a.period === period)
    .map(a => ({ start: a.startMinute, end: a.endMinute }))
    .sort((a, b) => a.start - b.start);

  const gaps: MinuteRange[] = [];
  let cursor = bounds.start;
  for (const range of taken) {
    if (range.start > cursor) gaps.push({ start: cursor, end: range.start });
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < bounds.end) gaps.push({ start: cursor, end: bounds.end });
  return gaps;
}

/** Primer tramo existente que se pisa con el rango pedido (misma regla [inicio, fin) que el backend). */
export function findOverlap<T extends RangeLike & { id: string }>(
  request: RangeLike,
  assignments: T[],
  ignoredId?: string | null
): T | null {
  return assignments.find(other =>
    other.id !== ignoredId &&
    other.period === request.period &&
    request.startMinute < other.endMinute &&
    other.startMinute < request.endMinute
  ) ?? null;
}

/** Descripción corta de un tramo para mensajes, ej. "1T 10'–25' (C3)". */
export function describeSegment(a: ZoneAssignmentResponse): string {
  return `${a.period}T ${a.startMinute}'–${a.endMinute}' (${zoneLabel(a)})`;
}

// --- Eventos por zona (derivados de `event.zone`, que calcula el backend) ---

export type ZonePeriodFilter = 'ALL' | ZonePeriod;

export type ZoneEvent = Pick<MatchTimelineEventResponse, 'id' | 'period' | 'matchTime' | 'zone'> & {
  /** Su zona (fila y columna) la da el propio evento: ningún cambio de tramos se la da ni se la quita. */
  zonePoint?: boolean;
};

const SECONDS_PER_MINUTE = 60;

/**
 * Segundo de juego con el que se ubica un evento en los tramos. El tiempo añadido cuenta como el minuto
 * 40 (1T) o el 80 (2T): se limita al último segundo del tiempo, igual que `EventZoneResolver` del backend.
 */
export function effectiveMatchTime(period: ZonePeriod, matchTimeSeconds: number): number {
  return Math.min(matchTimeSeconds, periodRange(period).end * SECONDS_PER_MINUTE - 1);
}

function inPeriod<T extends ZoneEvent>(events: T[], filter: ZonePeriodFilter): T[] {
  return filter === 'ALL' ? events : events.filter(event => event.period === filter);
}

/** Orden cronológico: por tiempo y, dentro de él, por minuto de juego. */
export function sortChronologically<T extends ZoneEvent>(events: T[]): T[] {
  return [...events].sort((a, b) => a.period - b.period || a.matchTime - b.matchTime);
}

/** Cantidad de eventos por celda; solo informa las celdas con al menos un evento. */
export function countByCell(events: ZoneEvent[], filter: ZonePeriodFilter): ZoneCellSummary[] {
  const counts = new Map<string, ZoneCellSummary>();
  for (const event of inPeriod(events, filter)) {
    if (!event.zone) continue;
    const key = `${event.zone.row}-${event.zone.col}`;
    const entry = counts.get(key) ?? { row: event.zone.row, col: event.zone.col, eventCount: 0 };
    entry.eventCount++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => a.row - b.row || a.col - b.col);
}

export function unzonedEvents<T extends ZoneEvent>(events: T[], filter: ZonePeriodFilter): T[] {
  return sortChronologically(inPeriod(events, filter).filter(event => !event.zone));
}

/** Eventos que caerían en un rango: mismo tiempo y minuto [inicio, fin), igual que el resolver del backend. */
export function eventsInRange<T extends ZoneEvent>(range: RangeLike, events: T[]): T[] {
  return events.filter(event => {
    if (event.period !== range.period) return false;
    const seconds = effectiveMatchTime(range.period, event.matchTime);
    return seconds >= range.startMinute * SECONDS_PER_MINUTE && seconds < range.endMinute * SECONDS_PER_MINUTE;
  });
}

/** Eventos del rango cuya zona depende de un tramo: los puntos ya tienen la suya por la regla del tipo. */
export function eventsLinkedByRange<T extends ZoneEvent>(range: RangeLike, events: T[]): T[] {
  return eventsInRange(range, events.filter(event => !event.zonePoint));
}

/** Eventos que hoy tienen zona gracias al rango anterior y la perderían con el nuevo. */
export function eventsReleasedByEdit<T extends ZoneEvent>(previous: RangeLike, next: RangeLike, events: T[]): T[] {
  const stillLinked = new Set(eventsLinkedByRange(next, events).map(event => event.id));
  return eventsLinkedByRange(previous, events).filter(event => !stillLinked.has(event.id));
}

/** Qué cuenta la cancha: jugadas por zona (Eventos) o minutos cubiertos por los tramos (Minutos). */
export type ZoneMapMode = 'EVENTS' | 'MINUTES';

/** Filtros de eventos: tipo y posesión. 'ALL' no filtra. */
export interface ZoneEventFilters {
  eventTypeId: string | 'ALL';
  possession: Possession | 'ALL';
}

export const NO_ZONE_EVENT_FILTERS: ZoneEventFilters = { eventTypeId: 'ALL', possession: 'ALL' };

/** Filtros que rigen según el modo: en Minutos no aplican (los tramos no tienen tipo ni posesión). */
export function eventFiltersFor(mode: ZoneMapMode, eventTypeId: string | 'ALL', possession: Possession | 'ALL'): ZoneEventFilters {
  return mode === 'EVENTS' ? { eventTypeId, possession } : NO_ZONE_EVENT_FILTERS;
}

/** El tipo elegido solo vale si el partido lo tiene (un valor recordado puede haber quedado viejo); si no, "ALL". */
export function validTypeFilter(eventTypeId: string | 'ALL', options: EventTypeOption[]): string | 'ALL' {
  return options.some(option => option.id === eventTypeId) ? eventTypeId : 'ALL';
}

type FilterableEvent = Pick<MatchTimelineEventResponse, 'eventTypeId' | 'teamPossession'>;

export function filterEvents<T extends FilterableEvent>(events: T[], filters: ZoneEventFilters): T[] {
  return events.filter(event =>
    (filters.eventTypeId === 'ALL' || event.eventTypeId === filters.eventTypeId) &&
    (filters.possession === 'ALL' || event.teamPossession === filters.possession)
  );
}

/** Minutos de partido que cubren los tramos en una celda. */
export interface ZoneCellMinutes {
  row: number;
  col: number;
  minutes: number;
}

/** Minutos cubiertos por los tramos en cada celda, dentro del tiempo elegido; solo informa las celdas con tramos. */
export function minutesByCell(assignments: ZoneAssignmentResponse[], filter: ZonePeriodFilter): ZoneCellMinutes[] {
  const totals = new Map<string, ZoneCellMinutes>();
  for (const assignment of assignments.filter(a => filter === 'ALL' || a.period === filter)) {
    const key = `${assignment.row}-${assignment.col}`;
    const entry = totals.get(key) ?? { row: assignment.row, col: assignment.col, minutes: 0 };
    entry.minutes += assignment.endMinute - assignment.startMinute;
    totals.set(key, entry);
  }
  return [...totals.values()].sort((a, b) => a.row - b.row || a.col - b.col);
}

/** Tipo de evento presente en el partido, para las opciones del filtro. */
export interface EventTypeOption {
  id: string;
  name: string;
}

/** Tipos que aparecen en los eventos, sin repetir y por nombre. */
export function eventTypeOptions(events: Pick<MatchTimelineEventResponse, 'eventTypeId' | 'eventTypeName'>[]): EventTypeOption[] {
  const names = new Map(events.map(event => [event.eventTypeId, event.eventTypeName]));
  return [...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** Minutos de un tiempo que ya tienen un tramo asignado (0–40). */
export function coverageMinutes(assignments: RangeLike[], period: ZonePeriod): number {
  const covered = assignments
    .filter(a => a.period === period)
    .reduce((sum, a) => sum + (a.endMinute - a.startMinute), 0);
  return Math.min(ZONE_HALF_MINUTES, covered);
}

/** Porcentaje (0–100, redondeado) de los 80 minutos del partido que ya tienen un tramo asignado. */
export function zoneCoveragePercent(assignments: RangeLike[]): number {
  const covered = coverageMinutes(assignments, 1) + coverageMinutes(assignments, 2);
  return Math.round((covered / (ZONE_HALF_MINUTES * 2)) * 100);
}
