import { ZONE_GRID_COLS, ZONE_HALF_MINUTES, ZoneAssignmentResponse, ZonePeriod } from '../../types/zone.types';
import { ZONE_COLUMN_NAMES, ZONE_ROW_LETTERS, columnRangeLabel, zoneLabel } from './zone-grid';
import { RuleEvent, ZoneRulesByType, isFixedZone, placeEventZone } from './zone-rule';
import { MinuteRange, ZoneEvent, ZonePeriodFilter, effectiveMatchTime, eventsInRange, findGaps, periodRange } from './zone-stats';

/** Largo del eje horizontal de la grilla de territorio: los 80 minutos del partido, con el 2T a continuación del 1T. */
export const TRACK_MINUTES = ZONE_HALF_MINUTES * 2;

/** Un bloque de esta duración o menor no entra con la etiqueta completa: muestra solo la letra del lateral. */
export const SHORT_BLOCK_MINUTES = 2;

/** En pantallas angostas, un bloque de menos de estos minutos no lleva etiqueta: el detalle va en su aria-label y tooltip. */
export const UNLABELED_BLOCK_MINUTES = 4;

/** Tramo de partido que muestra el eje horizontal (minutos acumulados): los 80 o un solo tiempo. */
export interface TrackWindow {
  start: number;
  end: number;
}

export const FULL_TRACK: TrackWindow = { start: 0, end: TRACK_MINUTES };

/** En pantallas angostas la grilla muestra un tiempo por vez; con "Todo" (o en pantallas anchas), los 80 minutos. */
export function trackWindow(filter: ZonePeriodFilter, compact: boolean): TrackWindow {
  return compact && filter !== 'ALL' ? periodRange(filter) : FULL_TRACK;
}

type TimeRange = Pick<ZoneAssignmentResponse, 'startMinute' | 'endMinute'>;

export interface BlockLayout {
  /** Posición izquierda y ancho, en % del eje de 80 minutos. */
  left: number;
  width: number;
}

/** Posición del minuto en el eje, en % del tramo mostrado (puede salirse de 0–100 si el minuto está fuera). */
export function minuteToPercent(minute: number, window: TrackWindow = FULL_TRACK): number {
  return ((minute - window.start) / (window.end - window.start)) * 100;
}

/** El rango se ve, al menos en parte, dentro del tramo mostrado. */
export function isInWindow(range: TimeRange, window: TrackWindow = FULL_TRACK): boolean {
  return range.endMinute > window.start && range.startMinute < window.end;
}

/** Posición y ancho del rango en el eje; si sobresale del tramo mostrado se recorta. */
export function blockLayout(range: TimeRange, window: TrackWindow = FULL_TRACK): BlockLayout {
  const start = Math.max(range.startMinute, window.start);
  const end = Math.max(Math.min(range.endMinute, window.end), start);
  return { left: minuteToPercent(start, window), width: ((end - start) / (window.end - window.start)) * 100 };
}

export function isShortBlock(range: TimeRange): boolean {
  return range.endMinute - range.startMinute <= SHORT_BLOCK_MINUTES;
}

/**
 * Etiqueta del bloque: la celda completa (D5) o, si es muy corto, solo la letra del lateral (D). En pantallas angostas
 * los de menos de 4 minutos no llevan etiqueta.
 */
export function blockLabel(assignment: ZoneAssignmentResponse, compact = false): string {
  if (compact && assignment.endMinute - assignment.startMinute < UNLABELED_BLOCK_MINUTES) return '';
  return isShortBlock(assignment) ? ZONE_ROW_LETTERS[assignment.row - 1] : zoneLabel(assignment);
}

/** Una fila de la grilla de territorio = una franja de la cancha (columna 1–6). */
export interface TerritoryRow {
  col: number;
  name: string;
  /** Metros desde la línea de gol propia, o "in-goal". */
  range: string;
}

/** Filas de arriba hacia abajo: el in-goal rival primero (dirección de ataque) y el propio al final. */
export function territoryRows(): TerritoryRow[] {
  return Array.from({ length: ZONE_GRID_COLS }, (_, i) => ZONE_GRID_COLS - i).map(col => ({
    col,
    name: ZONE_COLUMN_NAMES[col - 1],
    range: columnRangeLabel(col) || 'in-goal'
  }));
}

/** Eventos con zona por franja (columna de la cancha), dentro del tiempo elegido. */
export function countByFranja(events: ZoneEvent[], filter: ZonePeriodFilter): Map<number, number> {
  const counts = new Map<number, number>();
  for (const event of events) {
    if (!event.zone || (filter !== 'ALL' && event.period !== filter)) continue;
    counts.set(event.zone.col, (counts.get(event.zone.col) ?? 0) + 1);
  }
  return counts;
}

/** Minuto (entero) que corresponde a una posición horizontal dentro del tramo mostrado (por defecto, 0–79). */
export function minuteAtOffset(offsetX: number, trackWidth: number, window: TrackWindow = FULL_TRACK): number {
  if (!(trackWidth > 0)) return window.start;
  const span = window.end - window.start;
  const minute = window.start + Math.floor((offsetX / trackWidth) * span);
  return Math.min(Math.max(minute, window.start), window.end - 1);
}

export type PeriodGap = MinuteRange & { period: ZonePeriod };

/** Todos los huecos sin zona, 1T primero, con minutos acumulados de partido. */
export function allGaps(assignments: ZoneAssignmentResponse[]): PeriodGap[] {
  return ([1, 2] as ZonePeriod[]).flatMap(period =>
    findGaps(assignments, period).map(gap => ({ period, start: gap.start, end: gap.end })));
}

/** Hueco que contiene el minuto (rango [inicio, fin)); null si ese minuto ya está dentro de un tramo. */
export function gapAtMinute(assignments: ZoneAssignmentResponse[], minute: number): PeriodGap | null {
  return allGaps(assignments).find(gap => minute >= gap.start && minute < gap.end) ?? null;
}

/**
 * Rango sugerido para el próximo tramo, en minutos acumulados: empieza en el hueco que arranca en `afterMinute`
 * (o en el primero libre), dura como mucho `length` minutos y termina antes si hay un corte (un try). Null si el
 * partido está completo.
 */
export function suggestNextRange(
  assignments: ZoneAssignmentResponse[],
  afterMinute?: number,
  cuts: TramoCutMark[] = [],
  length = 5
): MinuteRange | null {
  const gaps = allGaps(assignments);
  if (gaps.length === 0) return null;

  const gap = (afterMinute !== undefined ? gaps.find(g => g.start >= afterMinute) : undefined) ?? gaps[0];
  return { start: gap.start, end: Math.min(gap.start + length, gap.end) };
}

export interface GapWithEvents extends PeriodGap {
  /** Eventos del partido que caen en el hueco (hoy quedan sin zona). */
  eventCount: number;
}

export function gapsWithEventCount(assignments: ZoneAssignmentResponse[], events: ZoneEvent[]): GapWithEvents[] {
  // Un evento que ya tiene zona (la fija su tipo) no queda sin zona por caer en un hueco.
  const unzoned = events.filter(event => !event.zone);
  return allGaps(assignments).map(gap => ({
    ...gap,
    eventCount: eventsInRange({ period: gap.period, startMinute: gap.start, endMinute: gap.end }, unzoned).length
  }));
}

/** Evento de zona fija a dibujar como marca de solo lectura sobre la grilla de territorio. */
export interface FixedZoneMark {
  eventId: string;
  eventTypeName: string;
  period: ZonePeriod;
  cell: { row: number; col: number };
  /** Minuto acumulado con decimales (22:30 -> 22,5); el tiempo añadido queda en el último segundo del tiempo. */
  minute: number;
}

const SECONDS_PER_MINUTE = 60;

function isZonePeriod(period: number): period is ZonePeriod {
  return period === 1 || period === 2;
}

/** Eventos cuya zona fija la da la regla del tipo, en orden cronológico y dentro del tiempo elegido. */
export function fixedZoneMarks(events: RuleEvent[], rules: ZoneRulesByType, filter: ZonePeriodFilter): FixedZoneMark[] {
  return events
    .filter(event => isZonePeriod(event.period) && (filter === 'ALL' || event.period === filter))
    .flatMap(event => {
      const rule = rules.get(event.eventTypeId);
      const cell = isFixedZone(rule, event.attributes) ? placeEventZone(rule, event.teamPossession, event.attributes, null) : null;
      const period = event.period as ZonePeriod;
      return cell
        ? [{ eventId: event.id, eventTypeName: event.eventTypeName, period, cell, minute: effectiveMatchTime(period, event.matchTime) / SECONDS_PER_MINUTE }]
        : [];
    })
    .sort((a, b) => a.minute - b.minute);
}

/** Texto de la marca para el tooltip y los lectores de pantalla, ej. "Try 22:30 · D6 · zona fija por el tipo". */
export function describeFixedMark(mark: FixedZoneMark): string {
  const seconds = Math.round(mark.minute * SECONDS_PER_MINUTE);
  const clock = `${String(Math.floor(seconds / SECONDS_PER_MINUTE)).padStart(2, '0')}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, '0')}`;
  return `${mark.eventTypeName} ${clock} · ${zoneLabel(mark.cell)} · zona fija por el tipo`;
}

/**
 * Corte del territorio: después de un evento que reinicia el juego (Try, Try penal, Kick H, Drop goal) el tramo que lo
 * contiene tiene que terminar en `minute` (el minuto del evento + 1, en minutos acumulados).
 */
export interface TramoCutMark {
  eventId: string;
  eventTypeName: string;
  period: ZonePeriod;
  minute: number;
  /** Tipo y reloj del evento, ej. "Try 22:30" (tooltip y aviso de tope). */
  label: string;
}

/** El primer corte que un rango deja adentro y el mismo mensaje que el 409 del backend. */
export interface TramoCut {
  cut: TramoCutMark;
  message: string;
}

type TimedRange = Pick<ZoneAssignmentResponse, 'period' | 'startMinute' | 'endMinute'>;

/** Cortes del partido en orden cronológico, dentro del tiempo elegido. */
export function tramoCuts(events: RuleEvent[], rules: ZoneRulesByType, filter: ZonePeriodFilter): TramoCutMark[] {
  throw new Error('Sin implementar');
}

/** Primer corte que queda estrictamente adentro del rango: el tramo seguiría después del evento. */
export function crossedCut(range: TimedRange, cuts: TramoCutMark[]): TramoCutMark | null {
  throw new Error('Sin implementar');
}

/** Primer evento que el rango deja antes de su último minuto, con el mensaje del 409 del backend. */
export function findTramoCut(range: TimedRange, events: RuleEvent[], rules: ZoneRulesByType): TramoCut | null {
  throw new Error('Sin implementar');
}
