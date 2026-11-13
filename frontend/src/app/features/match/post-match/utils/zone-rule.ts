import { MatchTimelineEventResponse } from '../../types/event.types';
import { BackendEventTypeResponse, ZoneRule } from '../../types/event-type.types';
import { Possession } from '../../types/live-capture.types';
import { countsAsScoring } from '../../statistics/calculators/event-rules';
import { ZONE_GRID_COLS, ZONE_GRID_ROWS, ZoneCellRef, ZonePeriod } from '../../types/zone.types';
import { ZONE_ROW_LETTERS, zoneLabel } from './zone-grid';
import { effectiveMatchTime } from './zone-stats';

/** Evento con lo mínimo que la regla necesita para ubicarse. */
export type RuleEvent = Pick<MatchTimelineEventResponse,
  'id' | 'eventTypeId' | 'eventTypeName' | 'period' | 'matchTime' | 'teamPossession' | 'attributes'>;

/** Regla de zona de cada tipo de evento, por id; los tipos sin regla pueden faltar o valer null. */
export type ZoneRulesByType = ReadonlyMap<string, ZoneRule | null | undefined>;

/** De cada tipo del catálogo, lo que decide si un evento puntúa (`isScoring` y el campo con efecto `scoring`). */
export type ScoringTypesById = ReadonlyMap<string, Pick<BackendEventTypeResponse, 'isScoring' | 'templateEventFields'>>;

/** Tramo propuesto (nuevo o editado) que se quiere comprobar contra los eventos que contiene. */
export interface RuleRange {
  period: ZonePeriod;
  startMinute: number;
  endMinute: number;
  row: number;
  col: number;
}

export interface ZoneRuleConflict {
  event: RuleEvent;
  /** Mismo texto que devuelve el backend (409) para que el aviso previo y el del servidor coincidan. */
  message: string;
}

const SECONDS_PER_MINUTE = 60;

/** Lado del apoyo (atributo `rowFrom`) -> fila, mirando al ataque. */
const ROW_BY_SIDE = new Map<string, number>([['left', 1], ['center', 2], ['right', 3]]);

type Attributes = Record<string, unknown> | null | undefined;

function onlyValue(values: number[] | null | undefined): number | null {
  return values?.length === 1 ? values[0] : null;
}

function rowFromAttribute(rule: ZoneRule, attributes: Attributes): number | null {
  const side = rule.rowFrom ? attributes?.[rule.rowFrom] : undefined;
  return typeof side === 'string' ? ROW_BY_SIDE.get(side) ?? null : null;
}

/** Sin lista (o vacía) no hay restricción en ese eje. */
function allows(allowed: number[] | null | undefined, value: number): boolean {
  return !allowed || allowed.length === 0 || allowed.includes(value);
}

function mirrorColumn(col: number): number {
  return ZONE_GRID_COLS + 1 - col;
}

/** Celda vista desde el otro equipo: la columna (6 <-> 1) y la fila (I <-> D) se invierten; dos veces es la original. */
function mirrorCell(cell: ZoneCellRef): ZoneCellRef {
  return { row: ZONE_GRID_ROWS + 1 - cell.row, col: mirrorColumn(cell.col) };
}

function orient(cell: ZoneCellRef, mirrored: boolean): ZoneCellRef {
  return mirrored ? mirrorCell(cell) : cell;
}

/**
 * Celda final de un evento (espejo de `EventZoneResolver` del backend): aplica la regla del tipo sobre la celda del
 * tramo y la perspectiva del equipo que lo ejecuta (el rival se espeja). Null si no hay celda.
 * La fila sale del atributo del lado, de la fila única de la regla o del tramo; la columna, de la única permitida o del tramo.
 */
export function placeEventZone(
  rule: ZoneRule | null | undefined,
  possession: Possession | null | undefined,
  attributes: Record<string, unknown> | null | undefined,
  assignmentCell: ZoneCellRef | null
): ZoneCellRef | null {
  if (!rule) return assignmentCell;

  const fromOpponent = possession === 'OPPONENT';
  const assignment = assignmentCell ? orient(assignmentCell, fromOpponent) : null;
  const row = rowFromAttribute(rule, attributes) ?? onlyValue(rule.rows) ?? assignment?.row ?? null;
  const col = onlyValue(rule.columns) ?? assignment?.col ?? null;

  return row !== null && col !== null && allows(rule.rows, row) && allows(rule.columns, col)
    ? orient({ row, col }, fromOpponent)
    : null;
}

/** Verdadero si el evento cierra el tramo que lo contiene (Try, Try penal, Kick H, Drop goal). */
export function closesTramo(rule: ZoneRule | null | undefined): boolean {
  return rule?.closesTramo === true;
}

/**
 * Verdadero si el evento cierra el tramo que lo contiene: su tipo lo declara y el tanteo cuenta. Un Kick H o un drop
 * errados no reinician el juego con un saque de centro, así que no cortan. Un tipo ausente del catálogo cuenta como tanteo.
 */
export function eventClosesTramo(event: RuleEvent, rules: ZoneRulesByType, types: ScoringTypesById): boolean {
  const type = types.get(event.eventTypeId);
  return closesTramo(rules.get(event.eventTypeId)) && (!type || countsAsScoring(type, event.attributes));
}

/** Verdadero si la regla fija fila y columna sin necesitar ningún tramo. */
export function isFixedZone(rule: ZoneRule | null | undefined, attributes: Record<string, unknown> | null | undefined): boolean {
  return !!rule
    && onlyValue(rule.columns) !== null
    && (rowFromAttribute(rule, attributes) !== null || onlyValue(rule.rows) !== null);
}

/**
 * Columna en la que la regla fija el evento, vista en nuestra cancha (el rival se espeja: 6 -> 1). Null si la regla
 * deja varias columnas o ninguna. Alcanza para ubicar al evento en su franja aunque no se conozca la fila.
 */
export function fixedColumn(rule: ZoneRule | null | undefined, possession: Possession | null | undefined): number | null {
  const column = onlyValue(rule?.columns);
  return column !== null && possession === 'OPPONENT' ? mirrorColumn(column) : column;
}

function isContiguous(sortedValues: number[]): boolean {
  return sortedValues[sortedValues.length - 1] - sortedValues[0] === sortedValues.length - 1;
}

function describeAxis(values: number[] | null | undefined, noun: string, name: (value: number) => string): string | null {
  if (!values || values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const names = sorted.map(name);
  if (names.length === 1) return `la ${noun} ${names[0]}`;

  const last = names[names.length - 1];
  const list = names.length > 2 && isContiguous(sorted) ? `${names[0]} a ${last}` : `${names.slice(0, -1).join(', ')} y ${last}`;
  return `las ${noun}s ${list}`;
}

/** Texto de lo permitido (ej. "las columnas 2 a 5"); el mismo que arma el backend. */
export function describeZoneRule(rule: ZoneRule): string {
  return [
    describeAxis(rule.columns, 'columna', String),
    describeAxis(rule.rows, 'fila', row => ZONE_ROW_LETTERS[row - 1])
  ].filter((text): text is string => text !== null).join(' y ') || 'cualquier celda';
}

/** Reloj de partido de los mensajes: minutos acumulados y segundos con dos dígitos (ej. 65:00); igual que el backend. */
export function formatMatchTime(seconds: number): string {
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

function conflictMessage(event: RuleEvent, rule: ZoneRule, range: RuleRange): string {
  return `${event.eventTypeName} (${event.period}T ${formatMatchTime(event.matchTime)}) no puede quedar en `
    + `${zoneLabel(range)} (tramo ${range.period}T ${range.startMinute}'–${range.endMinute}'): solo puede ocurrir en ${describeZoneRule(rule)}`;
}

/** El tramo es lo que deja al evento en una celda prohibida: sin zona fija y sin celda permitida para su tipo. */
function isProhibitedByRange(rule: ZoneRule, event: RuleEvent, cell: ZoneCellRef): boolean {
  return !isFixedZone(rule, event.attributes) && placeEventZone(rule, event.teamPossession, event.attributes, cell) === null;
}

/** Primer evento (en orden cronológico) que el tramo propuesto dejaría en una celda prohibida para su tipo. */
export function findZoneRuleConflict(range: RuleRange, events: RuleEvent[], rules: ZoneRulesByType): ZoneRuleConflict | null {
  const cell: ZoneCellRef = { row: range.row, col: range.col };
  const insideRange = (event: RuleEvent): boolean => {
    const seconds = effectiveMatchTime(range.period, event.matchTime);
    return event.period === range.period
      && seconds >= range.startMinute * SECONDS_PER_MINUTE
      && seconds < range.endMinute * SECONDS_PER_MINUTE;
  };

  return [...events]
    .sort((a, b) => a.period - b.period || a.matchTime - b.matchTime)
    .filter(insideRange)
    .flatMap(event => {
      const rule = rules.get(event.eventTypeId);
      return rule && isProhibitedByRange(rule, event, cell) ? [{ event, message: conflictMessage(event, rule, range) }] : [];
    })[0] ?? null;
}
